import { directiveTable } from "./metadata";
import { type ParsedDocument } from "./document";
import { type Token } from "./lexer";
import { collectDocumentMacros, type DocumentMacroDefinition } from "./macros";

export type SymbolKind = "label" | "equate" | "variable" | "data" | "macro";

export type SymbolDefinition = {
  name: string;
  kind: SymbolKind;
  line: number;
  token: Token;
  macroDefinition: DocumentMacroDefinition | null;
  docComment?: string;
};

export function collectSymbols(document: ParsedDocument): Map<string, SymbolDefinition> {
  const symbols = new Map<string, SymbolDefinition>();
  const macroDefinitions = collectDocumentMacros(document);

  const addSymbol = (name: string, kind: SymbolKind, line: number, token: Token, macroDefinition: DocumentMacroDefinition | null = null) => {
    if (!symbols.has(name)) {
      symbols.set(name, defineSymbol(name, kind, line, token, macroDefinition, getDocComment(document, line)));
    }
  };

  for (const line of document.lines) {
    const node = line.node;

    if (node.shape === "equate") {
      addSymbol(node.label.lexeme, node.isVariable ? "variable" : "equate", line.line, node.label);
      continue;
    }

    if (node.shape === "labelOnly") {
      addSymbol(node.label.lexeme, "label", line.line, node.label);
      continue;
    }

    if (node.shape === "instruction" && node.label !== null) {
      addSymbol(node.label.lexeme, "label", line.line, node.label);
      continue;
    }

    if (node.shape === "directive" && node.label !== null) {
      const directive = directiveTable.get(node.directive.lexeme.toLowerCase());
      if (directive?.kind === "data" || directive?.kind === "storage") {
        addSymbol(node.label.lexeme, "data", line.line, node.label);
      } else if (directive?.name === "mac") {
        addSymbol(
          node.label.lexeme,
          "macro",
          line.line,
          node.label,
          macroDefinitions.get(node.label.lexeme) ?? null
        );
      } else {
        addSymbol(node.label.lexeme, "label", line.line, node.label);
      }
      continue;
    }

    if (node.shape === "data" && node.label !== null) {
      addSymbol(node.label.lexeme, "data", line.line, node.label);
    }
  }

  return symbols;
}

export function getDocComment(document: ParsedDocument, lineIndex: number): string | undefined {
  const parts: string[] = [];

  for (let index = lineIndex - 1; index >= 0; index -= 1) {
    const tokens = document.lines[index]?.tokens;
    const comment = tokens?.length === 1 && tokens[0]?.kind === "comment"
      ? tokens[0].lexeme
      : undefined;
    if (!comment?.startsWith(";! ")) {
      break;
    }
    parts.unshift(comment.slice(3));
  }

  const inlineComment = document.lines[lineIndex]?.tokens.find(
    (token) => token.kind === "comment" && token.lexeme.startsWith(";! ")
  );
  if (inlineComment !== undefined) {
    parts.push(inlineComment.lexeme.slice(3));
  }

  return parts.length > 0 ? parts.join("\n") : undefined;
}

export function findSymbol(
  openDocuments: ReadonlyMap<string, { parsed: ParsedDocument }>,
  name: string,
  kind?: SymbolKind
): { uri: string; symbol: SymbolDefinition } | null {
  for (const [uri, cached] of openDocuments.entries()) {
    const symbol = collectSymbols(cached.parsed).get(name);
    if (symbol !== undefined && (kind === undefined || symbol.kind === kind)) {
      return { uri, symbol };
    }
  }

  return null;
}

function defineSymbol(
  name: string,
  kind: SymbolKind,
  line: number,
  token: Token,
  macroDefinition: DocumentMacroDefinition | null = null,
  docComment?: string
): SymbolDefinition {
  const symbol: SymbolDefinition = {
    name,
    kind,
    line,
    token,
    macroDefinition
  };
  if (docComment !== undefined) {
    symbol.docComment = docComment;
  }
  return symbol;
}
