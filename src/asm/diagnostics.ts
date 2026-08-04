import { type ParsedDocument } from "./document";
import { type Expression, type Operand, walkExpression } from "./expression";
import { type Token } from "./lexer";
import { resolveLocalLabels, isLocalLabel, getGlobalLabelToken } from "./local-labels";
import { directiveTable, normalizeMnemonic, opcodeTable, type AddressingMode } from "./metadata";
import {
  isAssemblyEndDirective,
  type MacroDefinitionRegion,
  type ParsedLine
} from "./parser";
import { macroParameterPattern } from "./macros";
import { getEffectiveLines, splitMacroCallArguments, type ExpandedToken } from "./expansion";
import { MAX_MACRO_EXPANSION_DEPTH, MAX_MACRO_EXPANSION_LINES } from "./limits";

export type DiagnosticCode =
  | "duplicate-symbol"
  | "duplicate-macro-definition"
  | "unresolved-reference"
  | "malformed-line"
  | "unknown-directive"
  | "unsupported-instruction"
  | "unknown-syntax"
  | "missing-macro-end"
  | "macro-arity-mismatch"
  | "macro-recursion"
  | "deep-macro-expansion"
  | "token-pasted-name"
  | "unresolved-conditional"
  | "invalid-macro-local-label"
  | "forward-macro-call"
  | "forward-equate-reference"
  | "invalid-addressing-mode";

export type Diagnostic = {
  filePath: string;
  line: number;
  code: DiagnosticCode;
  message: string;
  startCharacter?: number;
  endCharacter?: number;
};

function createMacroTokenDiagnostic(
  filePath: string,
  line: number,
  token: Token,
  code: DiagnosticCode,
  message: string
): Diagnostic {
  return {
    filePath,
    line,
    code,
    message,
    startCharacter: token.start,
    endCharacter: token.end
  };
}

function addTokenPastedNameDiagnostic(
  diagnostics: Diagnostic[],
  filePath: string,
  line: number,
  token: Token,
  nameKind = "name"
): void {
  if (!macroParameterPattern.test(token.lexeme) && /\]\d+/.test(token.lexeme)) {
    diagnostics.push(
      createMacroTokenDiagnostic(
        filePath,
        line,
        token,
        "token-pasted-name",
        `Unsupported token-pasted ${nameKind} ${token.lexeme}`
      )
    );
  }
}

function addInvalidMacroLocalLabelDiagnostic(
  diagnostics: Diagnostic[],
  filePath: string,
  line: number,
  token: Token
): void {
  diagnostics.push(
    createMacroTokenDiagnostic(
      filePath,
      line,
      token,
      "invalid-macro-local-label",
      `Local labels (${token.lexeme}) cannot be used inside macros.`
    )
  );
}

export type DocumentEntry = {
  filePath: string;
  document: ParsedDocument;
};

type SymbolRecord = {
  name: string;
  line: number;
  filePath: string;
  startCharacter: number;
  endCharacter: number;
};

type MacroRecord = {
  name: string;
  line: number;
  filePath: string;
  startCharacter: number;
  endCharacter: number;
  maxParameterIndex: number;
  usesArgumentCountParameter: boolean;
  documentIndex: number;
};

type EquateRecord = {
  name: string;
  line: number;
  documentIndex: number;
};

function isDefinedBeforeUse(
  definition: { documentIndex: number; line: number },
  documentIndex: number,
  line: number
): boolean {
  return (
    definition.documentIndex < documentIndex ||
    (definition.documentIndex === documentIndex && definition.line <= line)
  );
}

export function collectWorkspaceDiagnostics(
  documents: readonly DocumentEntry[]
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const globalSymbols = new Set<string>();
  const symbolRecords: SymbolRecord[] = [];
  const macrosByName = new Map<string, MacroRecord[]>();
  const equatesByName = new Map<string, EquateRecord[]>();
  const activeLinesByDocument = new Map<ParsedDocument, ReadonlySet<number>>();
  const conditionalValues = new Map<string, number>();

  for (const [documentIndex, entry] of documents.entries()) {
    const activeLines = collectActiveLines(entry.document, conditionalValues);
    activeLinesByDocument.set(entry.document, activeLines);

    for (const symbol of collectGlobalDefinitions(entry.document, entry.filePath, activeLines)) {
      symbolRecords.push(symbol);
      globalSymbols.add(symbol.name);
    }

    for (const equate of collectEquateDefinitions(entry.document, documentIndex, activeLines)) {
      const definitions = equatesByName.get(equate.name) ?? [];
      definitions.push(equate);
      equatesByName.set(equate.name, definitions);
    }

    for (const macroDefinition of entry.document.macroDefinitions) {
      const current = macrosByName.get(macroDefinition.name) ?? [];
      current.push({
        name: macroDefinition.name,
        line: macroDefinition.startLine,
        filePath: entry.filePath,
        startCharacter: macroDefinition.nameToken.start,
        endCharacter: macroDefinition.nameToken.end,
        maxParameterIndex: macroDefinition.maxParameterIndex,
        usesArgumentCountParameter: macroDefinition.parameterReferences.some(
          (parameterReference) => parameterReference.index === 0
        ),
        documentIndex
      });
      macrosByName.set(macroDefinition.name, current);
    }
  }

  diagnostics.push(...collectDuplicateSymbolDiagnostics(symbolRecords));
  diagnostics.push(...collectDuplicateMacroDiagnostics(macrosByName));

  for (const [documentIndex, entry] of documents.entries()) {
    const activeLines = activeLinesByDocument.get(entry.document);
    if (activeLines === undefined) continue;

    diagnostics.push(
      ...collectMalformedDiagnostics(entry.filePath, entry.document),
      ...collectUnknownDiagnostics(entry.filePath, entry.document, entry.document.macroDefinitions),
      ...collectAddressingModeDiagnostics(
        entry.filePath,
        entry.document,
        entry.document.macroDefinitions,
        conditionalValues
      ),
      ...collectMacroStructureDiagnostics(entry.filePath, entry.document),
      ...collectUnresolvedDiagnostics(
        entry.filePath,
        entry.document,
        globalSymbols,
        entry.document.macroDefinitions,
        equatesByName,
        documentIndex,
        activeLines
      ),
      ...collectMacroCallDiagnostics(entry.filePath, entry.document, macrosByName, documentIndex)
    );
  }

  return diagnostics;
}

type ConditionalBranch = {
  parentIsActive: boolean;
  condition: boolean | null;
};

function collectActiveLines(
  document: ParsedDocument,
  values: Map<string, number>
): ReadonlySet<number> {
  const activeLines = new Set<number>();
  const branches: ConditionalBranch[] = [];
  let isActive = true;

  for (const line of document.lines) {
    if (isActive && isAssemblyEndDirective(line.node)) {
      activeLines.add(line.line);
      break;
    }
    const directiveName = line.node.shape === "directive"
      ? line.node.directive.lexeme.toLowerCase()
      : null;

    if (directiveName === "do" || directiveName === "if") {
      if (isActive) {
        activeLines.add(line.line);
      }
      const operand = line.node.shape === "directive" ? line.node.operand : null;
      const value: number | null = isActive && operand !== null
        ? evaluateExpression(operand, values)
        : null;
      const condition: boolean | null = value === null ? null : value !== 0;
      branches.push({ parentIsActive: isActive, condition });
      isActive = isActive && condition !== false;
      continue;
    }

    if (directiveName === "else") {
      const branch = branches.at(-1);
      if (branch?.parentIsActive === true) {
        activeLines.add(line.line);
      }
      if (branch !== undefined) {
        isActive = branch.parentIsActive && branch.condition !== true;
      }
      continue;
    }

    if (directiveName === "fin") {
      const branch = branches.pop();
      if (branch?.parentIsActive === true) {
        activeLines.add(line.line);
      }
      if (branch !== undefined) {
        isActive = branch.parentIsActive;
      }
      continue;
    }

    if (!isActive) {
      continue;
    }
    activeLines.add(line.line);
    recordConditionalValue(line.node, values);
  }

  return activeLines;
}

function recordConditionalValue(node: ParsedLine, values: Map<string, number>): void {
  if (node.shape !== "equate") {
    return;
  }

  const value = evaluateExpression(node.expression, values);
  if (value === null) {
    return;
  }
  if (node.isVariable || !values.has(node.label.lexeme)) {
    values.set(node.label.lexeme, value);
  }
}

function evaluateExpression(expression: Expression, values: ReadonlyMap<string, number>): number | null {
  switch (expression.kind) {
    case "numericLiteral":
      return parseNumericLiteral(expression.value);
    case "identifier":
      return values.get(expression.value) ?? null;
    case "modifier": {
      const value = evaluateExpression(expression.expression, values);
      if (value === null || !Number.isSafeInteger(value)) {
        return null;
      }
      switch (expression.operator) {
        case "<":
          return value & 0xff;
        case ">":
          return (value >> 8) & 0xff;
        case "^":
          return (value >> 16) & 0xff;
      }
      return null;
    }
    case "unary": {
      const value = evaluateExpression(expression.expression, values);
      if (value === null) {
        return null;
      }
      return expression.operator === "+" ? value : -value;
    }
    case "binary":
      return evaluateBinaryExpression(expression, values);
    default:
      return null;
  }
}

function parseNumericLiteral(value: string): number | null {
  const radix = value.startsWith("$") ? 16 : value.startsWith("%") ? 2 : 10;
  const text = radix === 16 || radix === 2 ? value.slice(1).replace(/_/gu, "") : value;
  const parsed = Number.parseInt(text, radix);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function evaluateBinaryExpression(
  expression: Extract<Expression, { kind: "binary" }>,
  values: ReadonlyMap<string, number>
): number | null {
  const left = evaluateExpression(expression.left, values);
  const right = evaluateExpression(expression.right, values);
  if (left === null || right === null) {
    return null;
  }

  let value: number;
  switch (expression.operator) {
    case "+":
      value = left + right;
      break;
    case "-":
      value = left - right;
      break;
    case "*":
      value = left * right;
      break;
    case "/":
      if (right === 0) return null;
      value = Math.trunc(left / right);
      break;
    case "<":
      return left < right ? 1 : 0;
    case "=":
      return left === right ? 1 : 0;
    case ">":
      return left > right ? 1 : 0;
    case "#":
      return left !== right ? 1 : 0;
    case "&":
      value = left & right;
      break;
    case ".":
      value = left | right;
      break;
    case "!":
      value = left ^ right;
      break;
  }

  return Number.isSafeInteger(value) ? value : null;
}

function collectDuplicateSymbolDiagnostics(
  symbolRecords: readonly SymbolRecord[]
): readonly Diagnostic[] {
  const firstDefinitionByName = new Map<string, SymbolRecord>();
  const diagnostics: Diagnostic[] = [];

  for (const symbol of symbolRecords) {
    const firstDefinition = firstDefinitionByName.get(symbol.name);
    if (firstDefinition === undefined) {
      firstDefinitionByName.set(symbol.name, symbol);
      continue;
    }

    diagnostics.push({
      filePath: symbol.filePath,
      line: symbol.line,
      code: "duplicate-symbol",
      message: `Duplicate symbol ${symbol.name}; first defined at line ${firstDefinition.line + 1}`,
      startCharacter: symbol.startCharacter,
      endCharacter: symbol.endCharacter
    });
  }

  return diagnostics;
}

function collectDuplicateMacroDiagnostics(
  macrosByName: ReadonlyMap<string, readonly MacroRecord[]>
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [name, definitions] of macrosByName.entries()) {
    const firstDefinition = definitions[0];
    if (firstDefinition === undefined) {
      continue;
    }

    for (const duplicate of definitions.slice(1)) {
      diagnostics.push({
        filePath: duplicate.filePath,
        line: duplicate.line,
        code: "duplicate-macro-definition",
        message: `Duplicate macro definition ${name}; first defined at line ${firstDefinition.line + 1}`,
        startCharacter: duplicate.startCharacter,
        endCharacter: duplicate.endCharacter
      });
    }
  }

  return diagnostics;
}

function collectMalformedDiagnostics(
  filePath: string,
  document: ParsedDocument
): readonly Diagnostic[] {
  const assemblyEndLine = getDocumentAssemblyEndLine(document);
  return document.errors
    .filter((error) => assemblyEndLine === null || error.line <= assemblyEndLine)
    .map((error) => ({
      filePath,
      line: error.line,
      code: "malformed-line" as const,
      message: error.message
    }));
}

function getDocumentAssemblyEndLine(document: ParsedDocument): number | null {
  const endLine = document.lines.findIndex((line) => isAssemblyEndDirective(line.node));
  return endLine === -1 ? null : endLine;
}

function collectUnknownDiagnostics(
  filePath: string,
  document: ParsedDocument,
  macroDefinitions: readonly MacroDefinitionRegion[]
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const effectiveLines = getEffectiveLines(document, macroDefinitions);
  const assemblyEndLine = getDocumentAssemblyEndLine(document);

  for (const line of effectiveLines) {
    if (assemblyEndLine !== null && line.line > assemblyEndLine) {
      continue;
    }
    const lineLength = document.lines[line.line]?.node.text.length ?? 0;

    if (line.isExpanded) {
      // Virtual expansion text has no call-site columns. Only
      // argument-derived hex payload tokens map back to the call site;
      // directive tokens and raw-text patterns are body-derived and are
      // already diagnosed on the macro body line itself.
      const invalidHexPayload = getInvalidHexPayloadToken(line.node);
      if (invalidHexPayload !== null) {
        const range = resolveDiagnosticRange(line.isExpanded, invalidHexPayload, lineLength);
        if (range !== null) {
          diagnostics.push({
            filePath,
            line: line.line,
            code: "unknown-syntax",
            message: `Unknown syntax: ${invalidHexPayload.lexeme}`,
            startCharacter: range.start,
            endCharacter: range.end
          });
        }
      }
      continue;
    }

    const unknownDirectiveToken = getUnknownDirectiveToken(line.node);
    if (unknownDirectiveToken !== null) {
      const range = resolveDiagnosticRange(line.isExpanded, unknownDirectiveToken, lineLength);
      if (range !== null) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "unknown-directive",
          message: `Unknown directive: ${unknownDirectiveToken.lexeme}`,
          startCharacter: range.start,
          endCharacter: range.end
        });
      }
    }

    const invalidHexPayload = getInvalidHexPayloadToken(line.node);
    if (invalidHexPayload !== null) {
      const range = resolveDiagnosticRange(line.isExpanded, invalidHexPayload, lineLength);
      if (range !== null) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "unknown-syntax",
          message: `Unknown syntax: ${invalidHexPayload.lexeme}`,
          startCharacter: range.start,
          endCharacter: range.end
        });
      }
    }

    const unknownTextMatch = getUnknownTextPattern(line.node.text);
    if (unknownTextMatch !== null) {
      diagnostics.push({
        filePath,
        line: line.line,
        code: "unknown-syntax",
        message: `Unknown syntax: ${unknownTextMatch.text}`,
        startCharacter: unknownTextMatch.start,
        endCharacter: unknownTextMatch.end
      });
    }
  }

  return diagnostics;
}

function collectMacroStructureDiagnostics(
  filePath: string,
  document: ParsedDocument
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let lineLimitReported = false;

  function traceCalls(
    defName: string,
    callLine: number,
    start: number,
    end: number,
    stack: ReadonlySet<string>,
    depth: number,
    budget: { remaining: number }
  ) {
    if (stack.has(defName)) {
      diagnostics.push({
        filePath,
        line: callLine,
        code: "macro-recursion",
        message: `Recursive macro call detected for ${defName}`,
        startCharacter: start,
        endCharacter: end
      });
      return;
    }
    if (depth >= MAX_MACRO_EXPANSION_DEPTH) {
      diagnostics.push({
        filePath,
        line: callLine,
        code: "deep-macro-expansion",
        message: `Macro expansion depth exceeded`,
        startCharacter: start,
        endCharacter: end
      });
      return;
    }

    const macroDefinition = document.macroDefinitions.find(
      (definition) => definition.name === defName
    );
    if (macroDefinition === undefined) return;

    if (budget.remaining < macroDefinition.body.length) {
      if (!lineLimitReported) {
        lineLimitReported = true;
        diagnostics.push({
          filePath,
          line: callLine,
          code: "deep-macro-expansion",
          message: `Macro expansion line limit exceeded`,
          startCharacter: start,
          endCharacter: end
        });
      }
      return;
    }
    budget.remaining -= macroDefinition.body.length;

    const newStack = new Set(stack);
    newStack.add(defName);

    for (const bodyLine of macroDefinition.body) {
      for (const nested of bodyLine.nestedMacroCalls) {
        traceCalls(nested.macro.lexeme, callLine, start, end, newStack, depth + 1, budget);
      }
    }
  }

  for (const macroDefinition of document.macroDefinitions) {
    if (macroDefinition.endLine === null) {
      diagnostics.push({
        filePath,
        line: macroDefinition.startLine,
        code: "missing-macro-end",
        message: `Macro ${macroDefinition.name} is missing a closing eom/<<<`,
        startCharacter: macroDefinition.nameToken.start,
        endCharacter: macroDefinition.nameToken.end
      });
    }

    for (const bodyLine of macroDefinition.body) {
      for (const nested of bodyLine.nestedMacroCalls) {
        traceCalls(
          nested.macro.lexeme,
          bodyLine.line,
          nested.macro.start,
          nested.macro.end,
          new Set([macroDefinition.name]),
          1,
          { remaining: MAX_MACRO_EXPANSION_LINES }
        );
      }

      for (const ref of bodyLine.symbolReferences) {
        addTokenPastedNameDiagnostic(diagnostics, filePath, bodyLine.line, ref.token);
      }

      for (const ref of bodyLine.localLabelDefinitions) {
        addTokenPastedNameDiagnostic(diagnostics, filePath, bodyLine.line, ref.token);
        addInvalidMacroLocalLabelDiagnostic(diagnostics, filePath, bodyLine.line, ref.token);
      }

      for (const ref of bodyLine.localLabelReferences) {
        addTokenPastedNameDiagnostic(diagnostics, filePath, bodyLine.line, ref.token);
        addInvalidMacroLocalLabelDiagnostic(diagnostics, filePath, bodyLine.line, ref.token);
      }

      for (const call of bodyLine.nestedMacroCalls) {
        addTokenPastedNameDiagnostic(diagnostics, filePath, bodyLine.line, call.macro, "macro name");
      }

      const bodyNode = bodyLine.node;
      if (bodyNode.shape === "directive") {
        const lexeme = bodyNode.directive.lexeme.toLowerCase();
        if (lexeme === "do" || lexeme === "if" || lexeme === "else" || lexeme === "fin") {
          diagnostics.push({
            filePath,
            line: bodyLine.line,
            code: "unresolved-conditional",
            message: `Conditional assembly directive ${bodyNode.directive.lexeme} inside macro cannot be statically resolved`,
            startCharacter: bodyNode.directive.start,
            endCharacter: bodyNode.directive.end
          });
        }
      }

    }
  }

  return diagnostics;
}

function collectUnresolvedDiagnostics(
  filePath: string,
  document: ParsedDocument,
  globalSymbols: ReadonlySet<string>,
  macroDefinitions: readonly MacroDefinitionRegion[],
  equatesByName: ReadonlyMap<string, readonly EquateRecord[]>,
  documentIndex: number,
  activeLines: ReadonlySet<number>
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const localScope = resolveLocalLabels(document);
  const variableDefinitionLines = new Map<string, number>();
  for (const line of document.lines) {
    if (!activeLines.has(line.line)) {
      continue;
    }
    if (line.node.shape === "equate" && line.node.isVariable && !variableDefinitionLines.has(line.node.label.lexeme)) {
      variableDefinitionLines.set(line.node.label.lexeme, line.line);
    }
  }

  const macroParameterLines = new Map<number, Set<string>>();

  for (const macroDefinition of document.macroDefinitions) {
    for (const bodyLine of macroDefinition.body) {
      const lineParameters = macroParameterLines.get(bodyLine.line) ?? new Set<string>();
      for (const parameterReference of bodyLine.parameterReferences) {
        lineParameters.add(parameterReference.token.lexeme);
      }
      macroParameterLines.set(bodyLine.line, lineParameters);
    }
  }

  const effectiveLines = getEffectiveLines(document, macroDefinitions);

  for (const line of effectiveLines) {
    if (!activeLines.has(line.line)) {
      continue;
    }
    const lineLength = document.lines[line.line]?.node.text.length ?? 0;

    for (const reference of findExpressionReferences(line.node)) {
      if (!line.isExpanded && macroParameterLines.get(line.line)?.has(reference.lexeme) === true) {
        continue;
      }

      const range = resolveDiagnosticRange(line.isExpanded, reference, lineLength);

      if (reference.lexeme.startsWith("]")) {
        const definitionLine = variableDefinitionLines.get(reference.lexeme);
        if (definitionLine !== undefined) {
          if (line.line < definitionLine && !line.isExpanded && range !== null) {
            diagnostics.push({
              filePath,
              line: line.line,
              code: "unresolved-reference",
              message: `Unresolved variable reference ${reference.lexeme}`,
              startCharacter: range.start,
              endCharacter: range.end
            });
          }
          continue;
        }
      }

      if (isLocalLabel(reference.lexeme)) {
        const localKey = `${reference.lexeme}@${line.line}`;
        const localReference = localScope.references.get(localKey);
        if (localReference === undefined || !activeLines.has(localReference.targetLine)) {
          if (!line.isExpanded && range !== null) {
            diagnostics.push({
              filePath,
              line: line.line,
              code: "unresolved-reference",
              message: `Unresolved local reference ${reference.lexeme}`,
              startCharacter: range.start,
              endCharacter: range.end
            });
          }
        }
        continue;
      }

      const equateDefinitions = equatesByName.get(reference.lexeme);
      if (
        equateDefinitions !== undefined &&
        !equateDefinitions.some((definition) => isDefinedBeforeUse(definition, documentIndex, line.line)) &&
        range !== null
      ) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "forward-equate-reference",
          message: `EQU symbol ${reference.lexeme} must be defined before use`,
          startCharacter: range.start,
          endCharacter: range.end
        });
        continue;
      }

      if (!globalSymbols.has(reference.lexeme) && range !== null) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "unresolved-reference",
          message: `Unresolved reference ${reference.lexeme}`,
          startCharacter: range.start,
          endCharacter: range.end
        });
      }
    }
  }

  return diagnostics;
}

function collectMacroCallDiagnostics(
  filePath: string,
  document: ParsedDocument,
  macrosByName: ReadonlyMap<string, readonly MacroRecord[]>,
  documentIndex: number
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const macroCall of document.macroCalls) {
    const definitions = macrosByName.get(macroCall.macro.lexeme);
    if (definitions === undefined) {
      diagnostics.push({
        filePath,
        line: macroCall.line,
        code: "unsupported-instruction",
        message: `Unsupported instruction or undefined macro: ${macroCall.macro.lexeme}`,
        startCharacter: macroCall.macro.start,
        endCharacter: macroCall.macro.end
      });
      continue;
    }

    const definition = definitions.find((candidate) =>
      isDefinedBeforeUse(candidate, documentIndex, macroCall.line)
    );
    if (definition === undefined) {
      diagnostics.push({
        filePath,
        line: macroCall.line,
        code: "forward-macro-call",
        message: `Macro ${macroCall.macro.lexeme} must be defined before use`,
        startCharacter: macroCall.macro.start,
        endCharacter: macroCall.macro.end
      });
      continue;
    }
    const requiredArity = definition.maxParameterIndex;
    const actualArity = splitMacroCallArguments(macroCall.args).length;
    if (!definition.usesArgumentCountParameter && requiredArity !== actualArity) {
      diagnostics.push({
        filePath,
        line: macroCall.line,
        code: "macro-arity-mismatch",
        message: `Macro ${macroCall.macro.lexeme} expected ${requiredArity} argument(s) but received ${actualArity}`,
        startCharacter: macroCall.macro.start,
        endCharacter: macroCall.macro.end
      });
    }
  }

  return diagnostics;
}

function collectEquateDefinitions(
  document: ParsedDocument,
  documentIndex: number,
  activeLines: ReadonlySet<number>
): readonly EquateRecord[] {
  const equates: EquateRecord[] = [];
  for (const line of document.lines) {
    if (!activeLines.has(line.line)) {
      continue;
    }
    const token = line.node.shape === "equate" && !line.node.isVariable
      ? getGlobalLabelToken(line.node)
      : null;
    if (token !== null) {
      equates.push({ name: token.lexeme, line: line.line, documentIndex });
    }
  }
  return equates;
}

function collectGlobalDefinitions(
  document: ParsedDocument,
  filePath: string,
  activeLines: ReadonlySet<number>
): readonly SymbolRecord[] {
  const symbols: SymbolRecord[] = [];

  for (const line of document.lines) {
    if (!activeLines.has(line.line)) {
      continue;
    }
    const token = getGlobalDefinitionToken(line.node);
    if (token === null) {
      continue;
    }

    symbols.push({
      name: token.lexeme,
      line: line.line,
      filePath,
      startCharacter: token.start,
      endCharacter: token.end
    });
  }

  return symbols;
}

function getGlobalDefinitionToken(node: ParsedLine): Token | null {
  if (node.shape === "directive" && node.directive.lexeme.toLowerCase() === "mac") {
    return null;
  }
  return getGlobalLabelToken(node);
}

function findExpressionReferences(node: ParsedLine): readonly Token[] {
  if (node.shape === "instruction" && node.operand !== null) {
    return findReferencesInOperand(node.operand);
  }

  if (node.shape === "directive" && node.operand !== null) {
    const directive = directiveTable.get(node.directive.lexeme.toLowerCase());
    if (directive?.kind === "include" || directive?.kind === "build") {
      if (node.directive.lexeme.toLowerCase() === "typ") {
        const knownAliases = new Set([
          "txt", "bin", "sys", "bas", "var", "rel",
          "lib", "s16", "rtl", "exe", "pif", "tif",
          "nda", "cda", "tol", "dvr", "ldf", "fst"
        ]);
        return findReferencesInExpression(node.operand).filter(
          (ref) => !knownAliases.has(ref.lexeme.toLowerCase())
        );
      }
      return [];
    }
    return findReferencesInExpression(node.operand);
  }

  if (node.shape === "equate") {
    return findReferencesInExpression(node.expression);
  }

  if (node.shape === "data") {
    if (node.directive.lexeme.toLowerCase() === "hex") {
      return [];
    }

    const references: Token[] = [];
    for (const token of node.tokens) {
      if (token.kind === "identifier" || token.kind === "localLabel") {
        references.push(token);
      }
    }
    return references;
  }

  return [];
}

function findReferencesInOperand(operand: Operand): readonly Token[] {
  return findReferencesInExpression(operand.expression);
}

function findReferencesInExpression(expression: Expression): readonly Token[] {
  const tokens: Token[] = [];
  walkExpression(expression, (identifier) => tokens.push(identifier.token));
  return tokens;
}

function getUnknownDirectiveToken(node: ParsedLine): Token | null {
  if (node.shape !== "directive") {
    return null;
  }

  const directiveName = node.directive.lexeme.toLowerCase();
  if (directiveName === "eom" || node.directive.lexeme === "<<<") {
    return null;
  }

  const directive = directiveTable.get(directiveName);
  if (directive?.supported === false) {
    return node.directive;
  }

  return null;
}

function getUnknownTextPattern(text: string): { text: string; start: number; end: number } | null {
  const caretMatch = /\^/.exec(text);
  if (caretMatch !== null) {
    return { text: "^", start: caretMatch.index, end: caretMatch.index + 1 };
  }

  const pipeMatch = /\|/.exec(text);
  if (pipeMatch !== null) {
    return { text: "|", start: pipeMatch.index, end: pipeMatch.index + 1 };
  }

  const modifierMatch = /\b(lda|sta|cmp|adc|sbc|and|ora|eor|jmp|jsr|ldx|ldy|stx|sty|bit)\s+>[^=]/i.exec(text);
  if (modifierMatch !== null) {
    const modifierIndex = />/.exec(modifierMatch[0]);
    if (modifierIndex !== null) {
      const index = modifierMatch.index + modifierIndex.index;
      return { text: ">", start: index, end: index + 1 };
    }
  }

  return null;
}

function getInvalidHexPayloadToken(node: ParsedLine): Token | null {
  if (node.shape !== "data" || node.directive.lexeme.toLowerCase() !== "hex") {
    return null;
  }

  let expectValue = true;
  let lastComma: Token | null = null;

  for (const token of node.tokens) {
    if (token.kind === "expressionOperator" && token.lexeme === ",") {
      if (expectValue) {
        return token;
      }
      expectValue = true;
      lastComma = token;
      continue;
    }

    if (/^[0-9A-Fa-f]+$/.test(token.lexeme) && token.lexeme.length % 2 === 0) {
      expectValue = false;
      lastComma = null;
      continue;
    }

    return token;
  }

  if (expectValue && lastComma !== null) {
    return lastComma;
  }

  return null;
}

function resolveDiagnosticRange(
  isExpanded: boolean,
  token: Token,
  lineLength: number
): { start: number; end: number } | null {
  let rangeToken: Token = token;

  if (isExpanded) {
    const callSiteToken = (token as ExpandedToken).callSiteToken;
    if (callSiteToken === null || callSiteToken === undefined) {
      return null;
    }
    rangeToken = callSiteToken;
  }

  const start = Math.max(0, Math.min(rangeToken.start, lineLength));
  const end = Math.max(start, Math.min(rangeToken.end, lineLength));
  return { start, end };
}


function getOperandAddressingModes(
  mnemonic: string,
  forcesAbsolute: boolean,
  operand: Operand | null,
  values: ReadonlyMap<string, number>
): readonly AddressingMode[] {
  if (operand === null) {
    return ["implied"];
  }

  if (operand.immediate) {
    return ["immediate"];
  }

  if (operand.indirect) {
    if (operand.indexRegister === "x" && operand.indexPosition === "inside") {
      return ["indexedIndirect"];
    } else if (operand.indexRegister === "y" && operand.indexPosition === "outside") {
      return ["indirectIndexed"];
    } else if (operand.indexRegister === null) {
      return ["indirect"];
    }
    return [];
  }

  if (
    operand.expression.kind === "identifier" &&
    operand.expression.value.toLowerCase() === "a" &&
    (mnemonic === "asl" || mnemonic === "lsr" || mnemonic === "rol" || mnemonic === "ror")
  ) {
    return [];
  }

  const address = evaluateExpression(operand.expression, values);
  const isDirectPage = address !== null && address >= 0 && address <= 0xff;

  if (operand.indexRegister === "x") {
    if (forcesAbsolute) return ["absoluteX"];
    if (address === null) return ["zeroPageX", "absoluteX"];
    return isDirectPage ? ["zeroPageX"] : ["absoluteX"];
  }

  if (operand.indexRegister === "y") {
    if (forcesAbsolute) return ["absoluteY"];
    if (address === null) return ["zeroPageY", "absoluteY"];
    return isDirectPage ? ["zeroPageY"] : ["absoluteY"];
  }

  if (forcesAbsolute) return ["absolute"];
  if (address === null) return ["zeroPage", "absolute", "relative"];
  return isDirectPage ? ["zeroPage", "relative"] : ["absolute", "relative"];
}
function collectAddressingModeDiagnostics(
  filePath: string,
  document: ParsedDocument,
  macroDefinitions: readonly MacroDefinitionRegion[],
  values: ReadonlyMap<string, number>
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const effectiveLines = getEffectiveLines(document, macroDefinitions);
  const assemblyEndLine = getDocumentAssemblyEndLine(document);

  for (const line of effectiveLines) {
    if (assemblyEndLine !== null && line.line > assemblyEndLine) {
      continue;
    }
    if (line.isExpanded || line.node.shape !== "instruction") {
      continue;
    }

    const mnemonic = normalizeMnemonic(line.node.mnemonic.lexeme);
    const definition = opcodeTable.get(mnemonic);
    if (definition === undefined) {
      continue;
    }

    const possibleModes = getOperandAddressingModes(
      mnemonic,
      line.node.mnemonic.lexeme.endsWith(":"),
      line.node.operand,
      values
    );
    const hasValidMode = possibleModes.some((mode) => definition.modes.includes(mode));

    if (!hasValidMode) {
      const lineLength = document.lines[line.line]?.node.text.length ?? 0;
      const range = resolveDiagnosticRange(false, line.node.mnemonic, lineLength);
      diagnostics.push({
        filePath,
        line: line.line,
        code: "invalid-addressing-mode",
        message: `Invalid addressing mode for '${mnemonic}'`,
        startCharacter: range?.start ?? line.node.mnemonic.start,
        endCharacter: range?.end ?? line.node.mnemonic.end
      });
    }
  }

  return diagnostics;
}
