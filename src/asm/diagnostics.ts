import { type ParsedDocument } from "./document";
import { type Expression, type Operand } from "./expression";
import { resolveLocalLabels } from "./local-labels";
import { directiveTable } from "./metadata";
import { type ParsedLine } from "./parser";

export type DiagnosticCode =
  | "duplicate-symbol"
  | "unresolved-reference"
  | "malformed-line"
  | "unsupported-65816";

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

  for (const entry of documents) {
    for (const symbol of collectGlobalDefinitions(entry.document, entry.filePath)) {
      symbolRecords.push(symbol);
      globalSymbols.add(symbol.name);
    }
  }

  diagnostics.push(...collectDuplicateSymbolDiagnostics(symbolRecords));

  for (const entry of documents) {
    diagnostics.push(
      ...collectMalformedDiagnostics(entry.filePath, entry.document),
      ...collectUnsupportedDiagnostics(entry.filePath, entry.document),
      ...collectUnresolvedDiagnostics(entry.filePath, entry.document, globalSymbols)
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

function collectUnresolvedDiagnostics(
  filePath: string,
  document: ParsedDocument,
  globalSymbols: ReadonlySet<string>
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const localScope = resolveLocalLabels(document);

  for (const line of document.lines) {
    for (const reference of findExpressionReferences(line.node)) {
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
    const directive = directiveTable.get(node.directive.lexeme);
    if (directive?.kind === "include" || directive?.kind === "build") {
      if (node.directive.lexeme === "typ") {
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

  const directive = directiveTable.get(node.directive.lexeme);
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
