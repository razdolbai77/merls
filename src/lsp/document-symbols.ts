import {
  type Location,
  type Range,
  type SymbolInformation,
  SymbolKind
} from "vscode-languageserver/node";

import { parseDocument } from "../asm/document";
import { type ParsedLine } from "../asm/parser";

export function buildDocumentSymbols(
  uri: string,
  source: string
): SymbolInformation[] {
  const document = parseDocument(source);
  const symbols: SymbolInformation[] = [];

  for (const line of document.lines) {
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
  const name = getNodeName(node);
  const kind = getNodeKind(node);

  if (name === null || kind === null) {
    return null;
  }

  return {
    name,
    kind,
    location: createLocation(uri, line, name)
  };
}

function getNodeName(node: ParsedLine): string | null {
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

function createLocation(uri: string, line: number, name: string): Location {
  const range: Range = {
    start: {
      line,
      character: 0
    },
    end: {
      line,
      character: name.length
    }
  };

  return {
    uri,
    range
  };
}
