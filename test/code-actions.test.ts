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
  
  const braDiagnostic: Diagnostic = {
    range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
    message: "Unsupported 65816 syntax: bra",
    severity: DiagnosticSeverity.Error,
    code: "unsupported-65816"
  };

  const stzDiagnostic: Diagnostic = {
    range: { start: { line: 2, character: 0 }, end: { line: 2, character: 9 } },
    message: "Unsupported 65816 syntax: stz",
    severity: DiagnosticSeverity.Error,
    code: "unsupported-65816"
  };

  const actionsBra = provideCodeActions(map, "file:///test.S", [braDiagnostic]);
  assert.equal(actionsBra.length, 1);
  assert.equal(actionsBra[0].title, "Replace with jmp (6502 alternative)");
  assert.ok(actionsBra[0].edit);
  assert.ok(actionsBra[0].edit.changes);
  assert.equal(actionsBra[0].edit.changes["file:///test.S"][0].newText, "  jmp loop");

  const actionsStz = provideCodeActions(map, "file:///test.S", [stzDiagnostic]);
  assert.equal(actionsStz.length, 1);
  assert.equal(actionsStz[0].title, "Replace with lda #0 / sta (6502 alternative)");
  assert.ok(actionsStz[0].edit);
  assert.ok(actionsStz[0].edit.changes);
  assert.equal(actionsStz[0].edit.changes["file:///test.S"][0].newText, "  lda #0\n  sta $00");
}
