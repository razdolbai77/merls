import { type ParsedDocument } from "./document";
import { type Expression, type Operand } from "./expression";
import { type Token } from "./lexer";
import { resolveLocalLabels } from "./local-labels";
import { directiveTable } from "./metadata";
import { type ParsedLine } from "./parser";

export type DiagnosticCode =
  | "duplicate-symbol"
  | "duplicate-macro-definition"
  | "unresolved-reference"
  | "unresolved-macro"
  | "malformed-line"
  | "unsupported-65816"
  | "missing-macro-end"
  | "invalid-macro-nesting"
  | "macro-arity-mismatch";

export type Diagnostic = {
  filePath: string;
  line: number;
  code: DiagnosticCode;
  message: string;
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

export function collectWorkspaceDiagnostics(
  documents: readonly DocumentEntry[]
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const globalSymbols = new Set<string>();
  const symbolRecords: SymbolRecord[] = [];
  const macrosByName = new Map<string, SymbolRecord[]>();

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
        filePath: entry.filePath
      });
      macrosByName.set(macroDefinition.name, current);
    }
  }

  diagnostics.push(...collectDuplicateSymbolDiagnostics(symbolRecords));
  diagnostics.push(...collectDuplicateMacroDiagnostics(macrosByName));

  for (const entry of documents) {
    diagnostics.push(
      ...collectMalformedDiagnostics(entry.filePath, entry.document),
      ...collectUnsupportedDiagnostics(entry.filePath, entry.document),
      ...collectMacroStructureDiagnostics(entry.filePath, entry.document),
      ...collectUnresolvedDiagnostics(entry.filePath, entry.document, globalSymbols),
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
  macrosByName: ReadonlyMap<string, readonly SymbolRecord[]>
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
        message: `Duplicate macro definition ${name}; first defined at line ${firstDefinition.line}`
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

function collectUnsupportedDiagnostics(
  filePath: string,
  document: ParsedDocument
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const line of document.lines) {
    const unsupportedDirective = getUnsupportedDirective(line.node);
    if (unsupportedDirective !== null) {
      diagnostics.push({
        filePath,
        line: line.line,
        code: "unsupported-65816",
        message: `Unsupported 65816 directive: ${unsupportedDirective}`
      });
    }

    const unsupportedText = getUnsupportedTextPattern(line.node.text);
    if (unsupportedText !== null) {
      diagnostics.push({
        filePath,
        line: line.line,
        code: "unsupported-65816",
        message: `Unsupported 65816 syntax: ${unsupportedText}`,
        // Provide a range spanning the entire text or at least first char
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

  for (const macroDefinition of document.macroDefinitions) {
    if (macroDefinition.endLine === null) {
      diagnostics.push({
        filePath,
        line: macroDefinition.startLine,
        code: "missing-macro-end",
        message: `Macro ${macroDefinition.name} is missing a closing eom/<<<`
      });
    }

    for (const bodyLine of macroDefinition.body) {
      const bodyNode = bodyLine.node;
      if (
        bodyNode.shape === "directive" &&
        bodyNode.label !== null &&
        bodyNode.directive.lexeme.toLowerCase() === "mac"
      ) {
        diagnostics.push({
          filePath,
          line: bodyLine.line,
          code: "invalid-macro-nesting",
          message: `Macro ${bodyNode.label.lexeme} cannot be defined inside macro ${macroDefinition.name}`
        });
      }
    }
  }

  return diagnostics;
}

function collectUnresolvedDiagnostics(
  filePath: string,
  document: ParsedDocument,
  globalSymbols: ReadonlySet<string>
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

  for (const line of document.lines) {
    for (const reference of findExpressionReferences(line.node)) {
      if (macroParameterLines.get(line.line)?.has(reference) === true) {
        continue;
      }

      if (reference.startsWith("]") || reference.startsWith(":")) {
        const localKey = `${reference}@${line.line}`;
        const localDefinitionKey = [...localScope.definitions.keys()].find((key) =>
          key.startsWith(`${reference}@`)
        );
        if (!localScope.references.has(localKey) && localDefinitionKey === undefined) {
          diagnostics.push({
            filePath,
            line: line.line,
            code: "unresolved-reference",
            message: `Unresolved local reference ${reference}`
          });
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
  macrosByName: ReadonlyMap<string, readonly SymbolRecord[]>
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const macroCall of document.macroCalls) {
    const definitions = macrosByName.get(macroCall.macro.lexeme);
    const definition = definitions?.[0];

    if (definition === undefined) {
      diagnostics.push({
        filePath,
        line: macroCall.line,
        code: "unresolved-macro",
        message: `Unresolved macro ${macroCall.macro.lexeme}`
      });
      continue;
    }

    const parsedDefinition = document.macroDefinitions.find(
      (macroDefinition) =>
        macroDefinition.name === macroCall.macro.lexeme &&
        macroDefinition.startLine === definition.line
    );
    const requiredArity = parsedDefinition?.maxParameterIndex ?? 0;
    const actualArity = countMacroCallArguments(macroCall.args);
    if (requiredArity !== actualArity) {
      diagnostics.push({
        filePath,
        line: macroCall.line,
        code: "macro-arity-mismatch",
        message: `Macro ${macroCall.macro.lexeme} expected ${requiredArity} argument(s) but received ${actualArity}`
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

function getUnsupportedDirective(node: ParsedLine): string | null {
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

function getUnsupportedTextPattern(text: string): string | null {
  const trimmed = text.trim().toLowerCase();

  if (/^(pea|mvn|mvp|bra|stz)\b/.test(trimmed)) {
    return trimmed.split(/\s+/, 1)[0] ?? trimmed;
  }

  if (trimmed.includes("^")) {
    return "^";
  }

  if (trimmed.includes("|")) {
    return "|";
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
