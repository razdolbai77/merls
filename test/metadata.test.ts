import assert from "node:assert/strict";

import {
  directiveTable,
  opcodeTable
} from "../src/asm/metadata";

export function runMetadataTableTest(): void {
  assert.equal(opcodeTable.size, 56);
  assert.deepEqual(opcodeTable.get("lda")?.modes, [
    "immediate",
    "zeroPage",
    "zeroPageX",
    "absolute",
    "absoluteX",
    "absoluteY",
    "indexedIndirect",
    "indirectIndexed"
  ]);
  assert.equal(opcodeTable.has("mvn"), false);

  assert.equal(directiveTable.get("org")?.supported, true);
  assert.equal(directiveTable.get("dum")?.supported, true);
  assert.equal(directiveTable.get("xc")?.supported, false);
  assert.equal(directiveTable.get("mx")?.supported, false);
  assert.equal(directiveTable.get("put")?.kind, "include");
}
