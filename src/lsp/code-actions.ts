import { CodeAction, Diagnostic } from "vscode-languageserver/node";
import { CachedDocument } from "../asm/document";

export function provideCodeActions(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  diagnostics: Diagnostic[]
): CodeAction[] {
  const cached = openDocuments.get(uri);
  if (!cached) return [];
  void cached;
  void uri;
  void diagnostics;
  return [];
}
