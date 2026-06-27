import assert from "node:assert/strict";
import { buildCachedDocument } from "../src/asm/document";
import { provideCodeActions } from "../src/lsp/code-actions";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";

export function runCodeActionsTest(): void {
  const source = `
  bra loop
  stz $00
  `;

  const cached = buildCachedDocument(source);
  const map = new Map([["file:///test.S", cached]]);

  const unknownDiagnostic: Diagnostic = {
    range: { start: { line: 1, character: 0 }, end: { line: 1, character: 8 } },
    message: "Unsupported instruction or undefined macro: bra",
    severity: DiagnosticSeverity.Error,
    code: "unsupported-instruction"
  };

  const actions = provideCodeActions(map, "file:///test.S", [unknownDiagnostic]);
  assert.equal(actions.length, 0);
}
