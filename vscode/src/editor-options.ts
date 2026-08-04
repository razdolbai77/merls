import { type TextDocument, type TextEditor } from "vscode";

export const pearlsEditorOptions = {
  indentSize: 8,
  tabSize: 8
} as const;

export const pearlsLanguageId = "6502";

export function is6502Document(document: TextDocument): boolean {
  return document.languageId === pearlsLanguageId;
}

export function applyPearlsEditorOptions(editor: TextEditor): boolean {
  if (!is6502Document(editor.document)) {
    return false;
  }

  editor.options = {
    ...editor.options,
    ...pearlsEditorOptions
  };
  return true;
}
