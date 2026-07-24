import { type ParsedDocument } from "./document";
import { type Expression, type Operand } from "./expression";
import { type Token } from "./lexer";
import { resolveLocalLabels } from "./local-labels";
import { directiveTable, opcodeTable, type AddressingMode } from "./metadata";
import { type ParsedLine, type MacroDefinitionRegion } from "./parser";
import { getEffectiveLines, splitMacroCallArguments } from "./expansion";
import { MAX_MACRO_EXPANSION_DEPTH } from "./limits";

export type DiagnosticCode =
  | "duplicate-symbol"
  | "duplicate-macro-definition"
  | "unresolved-reference"
  | "malformed-line"
  | "unknown-directive"
  | "unsupported-instruction"
  | "unknown-syntax"
  | "missing-macro-end"
  | "invalid-macro-nesting"
  | "macro-arity-mismatch"
  | "macro-recursion"
  | "deep-macro-expansion"
  | "token-pasted-name"
  | "unresolved-conditional"
  | "invalid-macro-local-label"
  | "invalid-addressing-mode";

export type Diagnostic = {
  filePath: string;
  line: number;
  code: DiagnosticCode;
  message: string;
  startCharacter?: number;
  endCharacter?: number;
};

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
};

export function collectWorkspaceDiagnostics(
  documents: readonly DocumentEntry[]
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const globalSymbols = new Set<string>();
  const symbolRecords: SymbolRecord[] = [];
  const macrosByName = new Map<string, MacroRecord[]>();

  for (const entry of documents) {
    for (const symbol of collectGlobalDefinitions(entry.document, entry.filePath)) {
      symbolRecords.push(symbol);
      globalSymbols.add(symbol.name);
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
      });
      macrosByName.set(macroDefinition.name, current);
    }
  }

  diagnostics.push(...collectDuplicateSymbolDiagnostics(symbolRecords));
  diagnostics.push(...collectDuplicateMacroDiagnostics(macrosByName));

  for (const entry of documents) {
    diagnostics.push(
      ...collectMalformedDiagnostics(entry.filePath, entry.document),
      ...collectUnknownDiagnostics(entry.filePath, entry.document, entry.document.macroDefinitions),
      ...collectAddressingModeDiagnostics(entry.filePath, entry.document, entry.document.macroDefinitions),
      ...collectMacroStructureDiagnostics(entry.filePath, entry.document),
      ...collectUnresolvedDiagnostics(entry.filePath, entry.document, globalSymbols, entry.document.macroDefinitions),
      ...collectMacroCallDiagnostics(entry.filePath, entry.document, macrosByName)
    );
  }

  return diagnostics;
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
  return document.errors.map((error) => ({
    filePath,
    line: error.line,
    code: "malformed-line" as const,
    message: error.message
  }));
}

function collectUnknownDiagnostics(
  filePath: string,
  document: ParsedDocument,
  macroDefinitions: readonly MacroDefinitionRegion[]
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const effectiveLines = getEffectiveLines(document, macroDefinitions);

  for (const line of effectiveLines) {
    const unknownDirectiveToken = getUnknownDirectiveToken(line.node);
    if (unknownDirectiveToken !== null) {
      diagnostics.push({
        filePath,
        line: line.line,
        code: "unknown-directive",
        message: `Unknown directive: ${unknownDirectiveToken.lexeme}`,
        startCharacter: unknownDirectiveToken.start,
        endCharacter: unknownDirectiveToken.end
      });
    }

    const invalidHexPayload = getInvalidHexPayloadPattern(line.node);
    if (invalidHexPayload !== null) {
      diagnostics.push({
        filePath,
        line: line.line,
        code: "unknown-syntax",
        message: `Unknown syntax: ${invalidHexPayload.text}`,
        startCharacter: invalidHexPayload.start,
        endCharacter: invalidHexPayload.end
      });
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

  function traceCalls(defName: string, callLine: number, start: number, end: number, stack: ReadonlySet<string>, depth: number) {
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

    const def = document.macroDefinitions.find(d => d.name === defName);
    if (!def) return;

    const newStack = new Set(stack);
    newStack.add(defName);

    for (const bLine of def.body) {
      for (const nested of bLine.nestedMacroCalls) {
        traceCalls(nested.macro.lexeme, callLine, start, end, newStack, depth + 1);
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
        traceCalls(nested.macro.lexeme, bodyLine.line, nested.macro.start, nested.macro.end, new Set([macroDefinition.name]), 1);
      }

      for (const ref of bodyLine.symbolReferences) {
        if (!/^\]\d+$/.test(ref.token.lexeme) && /\]\d+/.test(ref.token.lexeme)) {
          diagnostics.push({
            filePath,
            line: bodyLine.line,
            code: "token-pasted-name",
            message: `Unsupported token-pasted name ${ref.token.lexeme}`,
            startCharacter: ref.token.start,
            endCharacter: ref.token.end
          });
        }
      }

      for (const ref of bodyLine.localLabelDefinitions) {
        if (!/^\]\d+$/.test(ref.token.lexeme) && /\]\d+/.test(ref.token.lexeme)) {
          diagnostics.push({
            filePath,
            line: bodyLine.line,
            code: "token-pasted-name",
            message: `Unsupported token-pasted name ${ref.token.lexeme}`,
            startCharacter: ref.token.start,
            endCharacter: ref.token.end
          });
        }
        diagnostics.push({
          filePath,
          line: bodyLine.line,
          code: "invalid-macro-local-label",
          message: `Local labels (${ref.token.lexeme}) cannot be used inside macros.`,
          startCharacter: ref.token.start,
          endCharacter: ref.token.end
        });
      }

      for (const ref of bodyLine.localLabelReferences) {
        if (!/^\]\d+$/.test(ref.token.lexeme) && /\]\d+/.test(ref.token.lexeme)) {
          diagnostics.push({
            filePath,
            line: bodyLine.line,
            code: "token-pasted-name",
            message: `Unsupported token-pasted name ${ref.token.lexeme}`,
            startCharacter: ref.token.start,
            endCharacter: ref.token.end
          });
        }
        diagnostics.push({
          filePath,
          line: bodyLine.line,
          code: "invalid-macro-local-label",
          message: `Local labels (${ref.token.lexeme}) cannot be used inside macros.`,
          startCharacter: ref.token.start,
          endCharacter: ref.token.end
        });
      }

      for (const call of bodyLine.nestedMacroCalls) {
        if (!/^\]\d+$/.test(call.macro.lexeme) && /\]\d+/.test(call.macro.lexeme)) {
          diagnostics.push({
            filePath,
            line: bodyLine.line,
            code: "token-pasted-name",
            message: `Unsupported token-pasted macro name ${call.macro.lexeme}`,
            startCharacter: call.macro.start,
            endCharacter: call.macro.end
          });
        }
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

      if (
        bodyNode.shape === "directive" &&
        bodyNode.label !== null &&
        bodyNode.directive.lexeme.toLowerCase() === "mac"
      ) {
        diagnostics.push({
          filePath,
          line: bodyLine.line,
          code: "invalid-macro-nesting",
          message: `Macro ${bodyNode.label.lexeme} cannot be defined inside macro ${macroDefinition.name}`,
          startCharacter: bodyNode.label.start,
          endCharacter: bodyNode.label.end
        });
      }
    }
  }

  return diagnostics;
}

function collectUnresolvedDiagnostics(
  filePath: string,
  document: ParsedDocument,
  globalSymbols: ReadonlySet<string>,
  macroDefinitions: readonly MacroDefinitionRegion[]
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const localScope = resolveLocalLabels(document);
  const variableDefinitionLines = new Map<string, number>();
  for (const line of document.lines) {
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
    for (const reference of findExpressionReferences(line.node)) {
      if (!line.isExpanded && macroParameterLines.get(line.line)?.has(reference.lexeme) === true) {
        continue;
      }

      if (reference.lexeme.startsWith("]")) {
        const definitionLine = variableDefinitionLines.get(reference.lexeme);
        if (definitionLine !== undefined) {
          if (line.line < definitionLine && !line.isExpanded) {
            diagnostics.push({
              filePath,
              line: line.line,
              code: "unresolved-reference",
              message: `Unresolved variable reference ${reference.lexeme}`,
              startCharacter: reference.start,
              endCharacter: reference.end
            });
          }
          continue;
        }
      }

      if (reference.lexeme.startsWith("]") || reference.lexeme.startsWith(":")) {
        const localKey = `${reference.lexeme}@${line.line}`;

        if (!localScope.references.has(localKey)) {
          if (!line.isExpanded) {
            diagnostics.push({
              filePath,
              line: line.line,
              code: "unresolved-reference",
              message: `Unresolved local reference ${reference.lexeme}`,
              startCharacter: reference.start,
              endCharacter: reference.end
            });
          }
        }
        continue;
      }

      if (!globalSymbols.has(reference.lexeme)) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "unresolved-reference",
          message: `Unresolved reference ${reference.lexeme}`,
          startCharacter: reference.start,
          endCharacter: reference.end
        });
      }
    }
  }

  return diagnostics;
}

function collectMacroCallDiagnostics(
  filePath: string,
  document: ParsedDocument,
  macrosByName: ReadonlyMap<string, readonly MacroRecord[]>
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const macroCall of document.macroCalls) {
    const definitions = macrosByName.get(macroCall.macro.lexeme);
    const definition = definitions?.[0];

    if (definition === undefined) {
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

function collectGlobalDefinitions(
  document: ParsedDocument,
  filePath: string
): readonly SymbolRecord[] {
  const symbols: SymbolRecord[] = [];

  for (const line of document.lines) {
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
  if (node.shape === "equate" && !isLocalLabel(node.label.lexeme)) {
    return node.label;
  }

  if (node.shape === "labelOnly" && !isLocalLabel(node.label.lexeme)) {
    return node.label;
  }

  if (node.shape === "instruction" && node.label !== null && !isLocalLabel(node.label.lexeme)) {
    return node.label;
  }

  if (node.shape === "directive" && node.label !== null && !isLocalLabel(node.label.lexeme)) {
    if (node.directive.lexeme.toLowerCase() === "mac") {
      return null;
    }
    return node.label;
  }

  if (node.shape === "data" && node.label !== null && !isLocalLabel(node.label.lexeme)) {
    return node.label;
  }

  return null;
}

function findExpressionReferences(node: ParsedLine): readonly Token[] {
  if (node.shape === "instruction" && node.operand !== null) {
    const refs = findReferencesInOperand(node.operand);
    if (refs.length === 1 && refs[0].lexeme.toLowerCase() === "a") {
      const def = opcodeTable.get(node.mnemonic.lexeme.toLowerCase());
      if (def?.modes.includes("accumulator")) {
        if (node.operand.expression.kind === "identifier" && node.operand.expression.token === refs[0]) {
          return [];
        }
      }
    }
    return refs;
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
  switch (expression.kind) {
    case "identifier":
      return [expression.token];
    case "modifier":
      return findReferencesInExpression(expression.expression);
    case "unary":
      return findReferencesInExpression(expression.expression);
    case "binary":
      return [
        ...findReferencesInExpression(expression.left),
        ...findReferencesInExpression(expression.right)
      ];
    default:
      return [];
  }
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
  const trimmed = text.trim().toLowerCase();

  if (trimmed.includes("^")) {
    const index = text.indexOf("^");
    return { text: "^", start: index, end: index + 1 };
  }

  if (trimmed.includes("|")) {
    const index = text.indexOf("|");
    return { text: "|", start: index, end: index + 1 };
  }

  const match = /\b(lda|sta|cmp|adc|sbc|and|ora|eor|jmp|jsr|ldx|ldy|stx|sty|bit)\s+>[^=]/i.exec(text);
  if (match !== null) {
    const index = text.indexOf(">", match.index);
    if (index !== -1) {
      return { text: ">", start: index, end: index + 1 };
    }
  }

  return null;
}

function getInvalidHexPayloadPattern(node: ParsedLine): { text: string; start: number; end: number } | null {
  if (node.shape !== "data" || node.directive.lexeme.toLowerCase() !== "hex") {
    return null;
  }

  let expectValue = true;
  let lastComma: Token | null = null;

  for (const token of node.tokens) {
    if (token.kind === "expressionOperator" && token.lexeme === ",") {
      if (expectValue) {
        return {
          text: token.lexeme,
          start: token.start,
          end: token.end
        };
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

    return {
      text: token.lexeme,
      start: token.start,
      end: token.end
    };
  }

  if (expectValue && lastComma !== null) {
    return {
      text: lastComma.lexeme,
      start: lastComma.start,
      end: lastComma.end
    };
  }

  return null;
}

function isLocalLabel(name: string): boolean {
  return name.startsWith("]") || name.startsWith(":");
}


function getOperandAddressingModes(operand: Operand | null): readonly AddressingMode[] {
  if (operand === null) {
    return ["implied", "accumulator"];
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

  if (operand.indexRegister === "x") {
    return ["zeroPageX", "absoluteX"];
  }

  if (operand.indexRegister === "y") {
    return ["zeroPageY", "absoluteY"];
  }

  if (
    operand.expression.kind === "identifier" &&
    operand.expression.value.toLowerCase() === "a"
  ) {
    return ["accumulator", "zeroPage", "absolute", "relative"];
  }

  return ["zeroPage", "absolute", "relative"];
}

function collectAddressingModeDiagnostics(
  filePath: string,
  document: ParsedDocument,
  macroDefinitions: readonly MacroDefinitionRegion[]
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const effectiveLines = getEffectiveLines(document, macroDefinitions);

  for (const line of effectiveLines) {
    if (line.node.shape !== "instruction") {
      continue;
    }

    const mnemonic = line.node.mnemonic.lexeme.toLowerCase();
    const definition = opcodeTable.get(mnemonic);
    if (definition === undefined) {
      continue;
    }

    const possibleModes = getOperandAddressingModes(line.node.operand);
    const hasValidMode = possibleModes.some((mode) => definition.modes.includes(mode));

    if (!hasValidMode) {
      diagnostics.push({
        filePath,
        line: line.line,
        code: "invalid-addressing-mode",
        message: `Invalid addressing mode for '${mnemonic}'`,
        startCharacter: line.node.mnemonic.start,
        endCharacter: line.node.mnemonic.end
      });
    }
  }

  return diagnostics;
}
