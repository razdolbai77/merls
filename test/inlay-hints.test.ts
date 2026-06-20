import assert from "node:assert/strict";
import { InlayHintKind } from "vscode-languageserver/node";
import { buildCachedDocument } from "../src/asm/document";
import { buildInlayHints } from "../src/lsp/inlay-hints";

export function runInlayHintsTest(): void {
  const source = `
foo equ $1234
  lda foo
  `;

  const cached = buildCachedDocument(source);
  const map = new Map([["file:///test.S", cached]]);
  const hints = buildInlayHints(map, "file:///test.S");

  assert.equal(hints.length, 1);
  assert.equal(hints[0].label, ": $1234");
  assert.equal(hints[0].kind, InlayHintKind.Type);
  assert.equal(hints[0].paddingLeft, true);
  assert.equal(hints[0].position.line, 2);
  assert.equal(hints[0].position.character, 9); // length of "  lda foo"
}
