import { LSPErrorCodes, ResponseError, WorkspaceEdit, TextEdit } from "vscode-languageserver/node";
import { CachedDocument } from "../asm/document";
import { collectSymbols } from "../asm/symbols";
import { isLocalLabel } from "../asm/local-labels";
import { findReferences, getSymbolAtPosition } from "./symbol-navigation";

const merlinIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const macroParameterPattern = /^\]\d+$/u;

export function buildRenameEdits(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number,
  newName: string
): WorkspaceEdit | null {
  const cached = openDocuments.get(uri);
  const targetName = getSymbolAtPosition(cached, line, character);
  if (targetName === null) {
    return null;
  }

  if (macroParameterPattern.test(targetName)) {
    throw new ResponseError(
      LSPErrorCodes.RequestFailed,
      "Macro parameter placeholders such as ]1 cannot be renamed."
    );
  }

  const symbol = cached ? collectSymbols(cached.parsed).get(targetName) : undefined;
  const isVariable = symbol?.kind === "variable";
  if (isLocalLabel(targetName) && !isVariable) {
    throw new ResponseError(
      LSPErrorCodes.RequestFailed,
      "Local labels cannot be renamed because they are scoped to their enclosing global label."
    );
  }

  const newNameBase = isVariable && newName.startsWith("]") ? newName.slice(1) : newName;
  if (!merlinIdentifierPattern.test(newNameBase)) {
    throw new ResponseError(
      LSPErrorCodes.RequestFailed,
      "The new name must be a valid Merlin identifier: letters, digits, and underscores, starting with a letter or underscore."
    );
  }
  const newText = isVariable ? `]${newNameBase}` : newNameBase;

  const locations = findReferences(openDocuments, uri, line, character, true);
  if (locations.length === 0) {
    return null;
  }

  const changes: Record<string, TextEdit[]> = {};
  for (const loc of locations) {
    if (!changes[loc.uri]) {
      changes[loc.uri] = [];
    }
    changes[loc.uri].push(TextEdit.replace(loc.range, newText));
  }

  return { changes };
}
