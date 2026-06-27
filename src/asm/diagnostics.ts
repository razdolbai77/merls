import { type ParsedDocument } from "./document";
import { type Expression, type Operand } from "./expression";
import { type Token } from "./lexer";
import { resolveLocalLabels } from "./local-labels";
import { directiveTable } from "./metadata";
import { type ParsedLine, type MacroDefinitionRegion } from "./parser";
import { getEffectiveLines } from "./expansion";

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
  | "invalid-macro-local-label";

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
};

type MacroRecord = {
  name: string;
  line: number;
  filePath: string;
  startCharacter: number;
  endCharacter: number;
  maxParameterIndex: number;
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
        maxParameterIndex: macroDefinition.maxParameterIndex
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
      message: `Duplicate symbol ${symbol.name}; first defined at line ${firstDefinition.line}`
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
        message: `Duplicate macro definition ${name}; first defined at line ${firstDefinition.line}`,
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
    const unknownDirective = getUnknownDirective(line.node);
    if (unknownDirective !== null) {
      diagnostics.push({
        filePath,
        line: line.line,
        code: "unknown-directive",
        message: `Unknown directive: ${unknownDirective}`
      });
    }

    const unknownText = getUnknownTextPattern(line.node.text);
    if (unknownText !== null) {
      diagnostics.push({
        filePath,
        line: line.line,
        code: "unknown-syntax",
        message: `Unknown syntax: ${unknownText}`
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
    if (depth >= 50) {
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
      if (!line.isExpanded && macroParameterLines.get(line.line)?.has(reference) === true) {
        continue;
      }

      if (reference.startsWith("]") || reference.startsWith(":")) {
        const localKey = `${reference}@${line.line}`;
        const localDefinitionKey = [...localScope.definitions.keys()].find((key) =>
          key.startsWith(`${reference}@`)
        );
        if (!localScope.references.has(localKey) && localDefinitionKey === undefined) {
          // If we're in an expanded macro, local labels from the macro body will fail because resolveLocalLabels only runs on the unexpanded document!
          // We should ideally resolve them, or at least skip them for now if they are inside expanded macros?
          // For now, let's just let it report. Actually, we should probably ignore local labels if isExpanded is true to avoid false positives.
          if (!line.isExpanded) {
            diagnostics.push({
              filePath,
              line: line.line,
              code: "unresolved-reference",
              message: `Unresolved local reference ${reference}`
            });
          }
        }
        continue;
      }

      if (!globalSymbols.has(reference)) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "unresolved-reference",
          message: `Unresolved reference ${reference}`
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
    const actualArity = countMacroCallArguments(macroCall.args);
    if (requiredArity !== actualArity) {
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
    const name = getGlobalDefinitionName(line.node);
    if (name === null) {
      continue;
    }

    symbols.push({
      name,
      line: line.line,
      filePath
    });
  }

  return symbols;
}

function getGlobalDefinitionName(node: ParsedLine): string | null {
  if (node.shape === "equate" && !isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  if (node.shape === "labelOnly" && !isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  if (node.shape === "instruction" && node.label !== null && !isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  if (node.shape === "directive" && node.label !== null && !isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  if (node.shape === "data" && node.label !== null && !isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  return null;
}

function findExpressionReferences(node: ParsedLine): readonly string[] {
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
          (ref) => !knownAliases.has(ref.toLowerCase())
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
    const references: string[] = [];
    for (const token of node.tokens) {
      if (token.kind === "identifier" || token.kind === "localLabel") {
        references.push(token.lexeme);
      }
    }
    return references;
  }

  return [];
}

function findReferencesInOperand(operand: Operand): readonly string[] {
  return findReferencesInExpression(operand.expression);
}

function findReferencesInExpression(expression: Expression): readonly string[] {
  switch (expression.kind) {
    case "identifier":
      return [expression.value];
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

function getUnknownDirective(node: ParsedLine): string | null {
  if (node.shape !== "directive") {
    return null;
  }

  const directiveName = node.directive.lexeme.toLowerCase();
  if (directiveName === "eom" || node.directive.lexeme === "<<<") {
    return null;
  }

  const directive = directiveTable.get(directiveName);
  if (directive?.supported === false) {
    return node.directive.lexeme;
  }

  return null;
}

function getUnknownTextPattern(text: string): string | null {
  const trimmed = text.trim().toLowerCase();

  if (trimmed.includes("^")) {
    return "^";
  }

  if (trimmed.includes("|")) {
    return "|";
  }

  if (/\b(lda|sta|cmp|adc|sbc|and|ora|eor|jmp|jsr|ldx|ldy|stx|sty|bit)\s+>[^=]/.test(trimmed)) {
    return ">";
  }

  return null;
}

function isLocalLabel(name: string): boolean {
  return name.startsWith("]") || name.startsWith(":");
}

function countMacroCallArguments(tokens: readonly Token[]): number {
  if (tokens.length === 0) {
    return 0;
  }

  let depth = 0;
  let sawArgumentToken = false;
  let argumentsCount = 1;

  for (const token of tokens) {
    if (token.kind === "expressionOperator" && token.lexeme === "(") {
      depth += 1;
      sawArgumentToken = true;
      continue;
    }

    if (token.kind === "expressionOperator" && token.lexeme === ")") {
      depth = Math.max(0, depth - 1);
      sawArgumentToken = true;
      continue;
    }

    if (token.kind === "expressionOperator" && token.lexeme === "," && depth === 0) {
      argumentsCount += 1;
      continue;
    }

    sawArgumentToken = true;
  }

  return sawArgumentToken ? argumentsCount : 0;
}
