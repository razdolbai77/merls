import { WorkspaceEdit, TextEdit } from "vscode-languageserver/node";
import { CachedDocument } from "../asm/document";
import { findReferences } from "./symbol-navigation";

export function buildRenameEdits(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number,
  newName: string
): WorkspaceEdit | null {
  const locations = findReferences(openDocuments, uri, line, character, true);
  
  if (locations.length === 0) {
    return null;
  }

  const changes: Record<string, TextEdit[]> = {};
  
  for (const loc of locations) {
    if (!changes[loc.uri]) {
      changes[loc.uri] = [];
    }
    changes[loc.uri].push(TextEdit.replace(loc.range, newName));
  }

  return { changes };
}
