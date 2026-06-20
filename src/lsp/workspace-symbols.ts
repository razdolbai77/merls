import {
  SymbolKind,
  type SymbolInformation,
  type WorkspaceSymbol
} from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { buildDocumentSymbols } from "./document-symbols";

export function buildWorkspaceSymbols(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  query: string
): WorkspaceSymbol[] {
  const symbols: WorkspaceSymbol[] = [];

  for (const [uri, cached] of openDocuments.entries()) {
    const documentSymbols = buildDocumentSymbols(uri, cached);
    for (const symbol of documentSymbols) {
      if (matchesQuery(symbol, query)) {
        symbols.push({
          name: symbol.name,
          kind: symbol.kind,
          location: symbol.location
        });
      }
    }
  }

  return symbols;
}

function matchesQuery(symbol: SymbolInformation, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return true;
  }
  return symbol.name.toLowerCase().includes(normalizedQuery);
}
