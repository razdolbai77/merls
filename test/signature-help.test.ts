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

  const indexedSource = `
bigMac mac
  lda ]10
  eom

  bigMac value
  `;
  const indexedCached = buildCachedDocument(indexedSource);
  const indexedMap = new Map([["file:///indexed.S", indexedCached]]);
  const indexedHelp = buildSignatureHelp(indexedMap, "file:///indexed.S", 5, 8);
  assert.ok(indexedHelp);
  assert.equal(indexedHelp.signatures[0].parameters?.length, 10);
  assert.equal(indexedHelp.signatures[0].parameters?.[9]?.label, "]10");

  const edgeCaseSource = `
zeroMac mac
  eom

exprMac mac
  lda ]1
  sta ]2
  eom

  zeroMac
  exprMac (foo, x), bar+baz
  `;
  const edgeCaseCached = buildCachedDocument(edgeCaseSource);
  const edgeCaseMap = new Map([["file:///edge-cases.S", edgeCaseCached]]);

  const zeroArgHelp = buildSignatureHelp(edgeCaseMap, "file:///edge-cases.S", 9, 9);
  assert.ok(zeroArgHelp);
  assert.equal(zeroArgHelp.signatures[0].label, "zeroMac()");
  assert.equal(zeroArgHelp.signatures[0].parameters?.length, 0);
  assert.equal(zeroArgHelp.activeParameter, 0);

  const nestedArgHelp = buildSignatureHelp(edgeCaseMap, "file:///edge-cases.S", 10, 18);
  assert.ok(nestedArgHelp);
  assert.equal(nestedArgHelp.signatures[0].label, "exprMac(]1, ]2)");
  assert.equal(nestedArgHelp.activeParameter, 0);

  const secondArgHelp = buildSignatureHelp(edgeCaseMap, "file:///edge-cases.S", 10, 23);
  assert.ok(secondArgHelp);
  assert.equal(secondArgHelp.activeParameter, 1);
}
