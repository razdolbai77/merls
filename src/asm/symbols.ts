import { directiveTable } from "./metadata";
import { type ParsedDocument } from "./document";

export type SymbolKind = "label" | "equate" | "data" | "macro";

export type SymbolDefinition = {
  name: string;
  kind: SymbolKind;
  line: number;
};

export function collectSymbols(document: ParsedDocument): Map<string, SymbolDefinition> {
  const symbols = new Map<string, SymbolDefinition>();

  for (const line of document.lines) {
    const node = line.node;

    if (node.shape === "equate") {
      symbols.set(node.label.lexeme, defineSymbol(node.label.lexeme, "equate", line.line));
      continue;
    }

    if (node.shape === "labelOnly") {
      symbols.set(node.label.lexeme, defineSymbol(node.label.lexeme, "label", line.line));
      continue;
    }

    if (node.shape === "instruction" && node.label !== null) {
      symbols.set(node.label.lexeme, defineSymbol(node.label.lexeme, "label", line.line));
      continue;
    }

    if (node.shape === "directive" && node.label !== null) {
      const directive = directiveTable.get(node.directive.lexeme);
      if (directive?.kind === "data" || directive?.kind === "storage") {
        symbols.set(node.label.lexeme, defineSymbol(node.label.lexeme, "data", line.line));
      } else if (directive?.name === "mac") {
        symbols.set(node.label.lexeme, defineSymbol(node.label.lexeme, "macro", line.line));
      }
      continue;
    }

    if (node.shape === "data" && node.label !== null) {
      symbols.set(node.label.lexeme, defineSymbol(node.label.lexeme, "data", line.line));
    }
  }

  return symbols;
}

function defineSymbol(name: string, kind: SymbolKind, line: number): SymbolDefinition {
  return {
    name,
    kind,
    line
  };
}
