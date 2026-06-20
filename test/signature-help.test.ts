import assert from "node:assert/strict";
import { buildCachedDocument } from "../src/asm/document";
import { buildSignatureHelp } from "../src/lsp/signature-help";

export function runSignatureHelpTest(): void {
  const source = `
myMac mac
  lda ]1
  sta ]2
  eom

  myMac foo, bar
  `;

  const cached = buildCachedDocument(source);
  const map = new Map([["file:///test.S", cached]]);
  
  // cursor on myMac
  const help1 = buildSignatureHelp(map, "file:///test.S", 6, 8); // "  myMac "
  assert.ok(help1);
  assert.equal(help1.signatures.length, 1);
  assert.equal(help1.signatures[0].label, "myMac(]1, ]2)");
  assert.equal(help1.activeParameter, 0);

  // cursor after comma
  const help2 = buildSignatureHelp(map, "file:///test.S", 6, 12); // "  myMac foo,"
  assert.ok(help2);
  assert.equal(help2.activeParameter, 1);
}
