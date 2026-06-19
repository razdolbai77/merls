import { type SymbolInformation } from "vscode-languageserver/node";

import { buildDocumentSymbols } from "./document-symbols";

export function buildWorkspaceSymbols(
  openDocuments: ReadonlyMap<string, string>,
  query: string
): SymbolInformation[] {
  const normalizedQuery = query.trim().toLowerCase();
  const symbols: SymbolInformation[] = [];

  for (const [uri, source] of openDocuments.entries()) {
    for (const symbol of buildDocumentSymbols(uri, source)) {
      if (
        normalizedQuery.length === 0 ||
        symbol.name.toLowerCase().includes(normalizedQuery)
      ) {
        symbols.push(symbol);
      }
    }
  }

  return symbols;
}
