import assert from "node:assert/strict";

import { parseDocument } from "../src/asm/document";

export function runDocumentModelTest(): void {
  const source = [
    "TEXT    =   $FB39",
    "        adc (",
    "        lda #1",
    "",
    "; trailing note"
  ].join("\n");

  const document = parseDocument(source);

  assert.equal(document.lines.length, 5);
  assert.equal(document.errors.length, 1);
  assert.deepEqual(document.errors[0], {
    line: 1,
    text: "        adc (",
    message: "expected expression token"
  });

  assert.equal(document.lines[0]?.node.shape, "equate");
  assert.equal(document.lines[1]?.node.shape, "malformed");
  assert.equal(document.lines[2]?.node.shape, "instruction");
  assert.equal(document.lines[3]?.node.shape, "empty");
  assert.equal(document.lines[4]?.node.shape, "commentOnly");
}
