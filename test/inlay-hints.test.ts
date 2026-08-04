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

  // Duplicate equ names resolve to the first definition in load order,
  // matching duplicate-symbol diagnostics.
  {
    const firstDoc = buildCachedDocument("shared equ $11\n  lda shared\n");
    const secondDoc = buildCachedDocument("shared equ $22\n");
    const orderedMap = new Map([
      ["file:///first.S", firstDoc],
      ["file:///second.S", secondDoc]
    ]);
    const hints = buildInlayHints(orderedMap, "file:///first.S");
    assert.equal(hints.length, 1);
    assert.equal(hints[0].label, ": $11");

    const reversedMap = new Map([
      ["file:///second.S", secondDoc],
      ["file:///first.S", firstDoc]
    ]);
    const reversedHints = buildInlayHints(reversedMap, "file:///first.S");
    assert.equal(reversedHints.length, 1);
    assert.equal(reversedHints[0].label, ": $22");
  }

  // Within one document the first equ definition wins.
  {
    const localDup = buildCachedDocument("val equ 1\nval equ 2\n  lda val\n");
    const localMap = new Map([["file:///dup.S", localDup]]);
    const localHints = buildInlayHints(localMap, "file:///dup.S");
    assert.equal(localHints.length, 1);
    assert.equal(localHints[0].label, ": 1");
  }
}
