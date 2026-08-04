import { DocumentHighlight, DocumentHighlightKind } from "vscode-languageserver/node";

import { CachedDocument } from "../asm/document";
import { getSymbolAtPosition, collectDefinitions, collectReferences } from "./symbol-navigation";

export function buildDocumentHighlights(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number
): DocumentHighlight[] {
  const cached = openDocuments.get(uri);
  if (cached === undefined) {
    return [];
  }

  const targetName = getSymbolAtPosition(cached, line, character);
  if (targetName === null) {
    return [];
  }

  const highlights: DocumentHighlight[] = [];

  for (const definition of collectDefinitions(uri, cached)) {
    if (definition.name === targetName) {
      highlights.push({
        range: definition.location.range,
        kind: DocumentHighlightKind.Write
      });
    }
  }

  for (const reference of collectReferences(uri, cached)) {
    if (reference.name === targetName) {
      highlights.push({
        range: reference.location.range,
        kind: DocumentHighlightKind.Read
      });
    }
  }

  return highlights;
}
