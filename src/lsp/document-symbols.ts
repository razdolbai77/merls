import {
  type SymbolInformation,
  SymbolKind
} from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { type ParsedLine } from "../asm/parser";
import { type Token } from "../asm/lexer";

export function buildDocumentSymbols(
  uri: string,
  cached: CachedDocument
): SymbolInformation[] {
  const symbols: SymbolInformation[] = [];

  for (const line of cached.parsed.lines) {
    const symbol = toSymbolInformation(uri, line.node, line.line);
    if (symbol !== null) {
      symbols.push(symbol);
    }
  }

  return symbols;
}

function toSymbolInformation(
  uri: string,
  node: ParsedLine,
  line: number
): SymbolInformation | null {
  const labelToken = getNodeLabelToken(node);
  const kind = getNodeKind(node);

  if (labelToken === null || kind === null) {
    return null;
  }

  return {
    name: labelToken.lexeme,
    kind,
    location: {
      uri,
      range: {
        start: { line, character: labelToken.start },
        end: { line, character: labelToken.end }
      }
    }
  };
}

function getNodeLabelToken(node: ParsedLine): Token | null {
  if (node.shape === "equate") {
    return node.label;
  }

  if (node.shape === "labelOnly") {
    return node.label;
  }

  if (node.shape === "instruction" && node.label !== null) {
    return node.label;
  }

  if (node.shape === "directive" && node.label !== null) {
    return node.label;
  }

  if (node.shape === "data" && node.label !== null) {
    return node.label;
  }

  return null;
}

function getNodeKind(node: ParsedLine): SymbolKind | null {
  if (node.shape === "equate") {
    return SymbolKind.Variable;
  }

  if (node.shape === "labelOnly") {
    return SymbolKind.Method;
  }

  if (node.shape === "instruction" && node.label !== null) {
    return SymbolKind.Method;
  }

  if (node.shape === "directive" && node.label !== null) {
    return SymbolKind.Field;
  }

  if (node.shape === "data" && node.label !== null) {
    return SymbolKind.Field;
  }

  return null;
}
