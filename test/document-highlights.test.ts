import assert from "node:assert/strict";
import { DocumentHighlightKind } from "vscode-languageserver/node";
import { buildCachedDocument } from "../src/asm/document";
import { buildDocumentHighlights } from "../src/lsp/document-highlights";

export function runDocumentHighlightsTest(): void {
  const source = `
label1
  lda label1
  sta label2
label2 equ $00
  `;

  const cached = buildCachedDocument(source);

  // cursor on label1 definition
  const h1 = buildDocumentHighlights(cached, "file:///test.S", 1, 3);
  assert.equal(h1.length, 2);

  // find write (definition)
  const write1 = h1.find((h) => h.kind === DocumentHighlightKind.Write);
  assert.ok(write1);
  assert.equal(write1.range.start.line, 1);
  assert.equal(write1.range.start.character, 0);

  // find read (reference)
  const read1 = h1.find((h) => h.kind === DocumentHighlightKind.Read);
  assert.ok(read1);
  assert.equal(read1.range.start.line, 2);
  assert.equal(read1.range.start.character, 6);

  // cursor on label2 reference
  const h2 = buildDocumentHighlights(cached, "file:///test.S", 3, 9);
  assert.equal(h2.length, 2);

  const write2 = h2.find((h) => h.kind === DocumentHighlightKind.Write);
  assert.ok(write2);
  assert.equal(write2.range.start.line, 4);

  const read2 = h2.find((h) => h.kind === DocumentHighlightKind.Read);
  assert.ok(read2);
  assert.equal(read2.range.start.line, 3);

  // cursor on missing symbol
  const h3 = buildDocumentHighlights(cached, "file:///test.S", 2, 2); // on "lda" mnemonic
  assert.equal(h3.length, 0);
}
