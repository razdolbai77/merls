import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";


import { type TextDocument, type TextEditor } from "vscode";

type FormattingColumns = {
  formattingLabelColumn: number;
};

const localFormatterPath = path.resolve(__dirname, "../../dist/src/lsp/formatting.js");
const formatterModulePath = fs.existsSync(localFormatterPath)
  ? localFormatterPath
  : "@razdolbai/merls/dist/src/lsp/formatting";
const loadModule = createRequire(__filename);
const { formattingLabelColumn } = loadModule(formatterModulePath) as FormattingColumns;


export const pearlsEditorOptions = {
  indentSize: formattingLabelColumn,
  tabSize: formattingLabelColumn
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
