import { CodeAction, CodeActionKind, Diagnostic, TextEdit } from "vscode-languageserver/node";
import { CachedDocument } from "../asm/document";

export function provideCodeActions(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  diagnostics: Diagnostic[]
): CodeAction[] {
  const cached = openDocuments.get(uri);
  if (!cached) return [];

  const actions: CodeAction[] = [];

  for (const diag of diagnostics) {
    if (diag.code === "unsupported-65816") {
      const lineText = cached.source.split(/\r?\n/)[diag.range.start.line];
      if (!lineText) continue;

      const trimmed = lineText.trim().toLowerCase();

      if (trimmed.startsWith("bra ")) {
        // Quick fix: replace bra with jmp
        const newText = lineText.replace(/bra/i, "jmp");
        actions.push({
          title: "Replace with jmp (6502 alternative)",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diag],
          edit: {
            changes: {
              [uri]: [
                TextEdit.replace({
                  start: { line: diag.range.start.line, character: 0 },
                  end: { line: diag.range.start.line, character: lineText.length }
                }, newText)
              ]
            }
          }
        });
      }

      if (trimmed.startsWith("stz ")) {
        // Quick fix: replace stz with lda #0 and sta
        const operand = lineText.substring(lineText.toLowerCase().indexOf("stz") + 3).trim();
        const indentMatch = lineText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : "  ";
        const newText = `${indent}lda #0\n${indent}sta ${operand}`;
        actions.push({
          title: "Replace with lda #0 / sta (6502 alternative)",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diag],
          edit: {
            changes: {
              [uri]: [
                TextEdit.replace({
                  start: { line: diag.range.start.line, character: 0 },
                  end: { line: diag.range.start.line, character: lineText.length }
                }, newText)
              ]
            }
          }
        });
      }
    }
  }

  return actions;
}
