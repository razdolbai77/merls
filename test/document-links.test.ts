import assert from "node:assert/strict";
import { buildCachedDocument } from "../src/asm/document";
import { buildDocumentLinks } from "../src/lsp/document-links";

export function runDocumentLinksTest(): void {
  const source = `
  put main.S
  use "lib.S"
  asm other.S
  `;

  const cached = buildCachedDocument(source);
  const links = buildDocumentLinks("file:///workspace/src/index.S", cached);

  assert.equal(links.length, 3);

  assert.equal(links[0].target, "file:///workspace/src/main.S");
  assert.equal(links[0].range.start.line, 1);

  assert.equal(links[1].target, "file:///workspace/src/lib.S");
  assert.equal(links[1].range.start.line, 2);

  assert.equal(links[2].target, "file:///workspace/src/other.S");
  assert.equal(links[2].range.start.line, 3);
}
