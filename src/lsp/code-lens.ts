import { type CodeLens } from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { collectDefinitions, collectReferences } from "./symbol-navigation";

export function buildCodeLenses(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string
): CodeLens[] {
  const cached = openDocuments.get(uri);
  if (cached === undefined) {
    return [];
  }

  const definitions = collectDefinitions(uri, cached);
  const lenses: CodeLens[] = [];

  const workspaceReferences = new Map<string, number>();
  for (const [documentUri, doc] of openDocuments.entries()) {
    const references = collectReferences(documentUri, doc);
    for (const reference of references) {
      const count = workspaceReferences.get(reference.name) ?? 0;
      workspaceReferences.set(reference.name, count + 1);
    }
  }

  for (const definition of definitions) {
    // Skip local labels which start with ":" or "]" in Merlin
    if (definition.name.startsWith(":") || definition.name.startsWith("]")) {
      continue;
    }
    
    const count = workspaceReferences.get(definition.name) ?? 0;
    const title = count === 1 ? "1 reference" : `${count} references`;

    lenses.push({
      range: definition.location.range,
      command: {
        title,
        command: "merls.showReferences"
      }
    });
  }

  return lenses;
}
