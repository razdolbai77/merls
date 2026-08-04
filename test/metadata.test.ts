import assert from "node:assert/strict";

import {
  directiveTable,
  opcodeTable
} from "../src/asm/metadata";

export function runMetadataTableTest(): void {
  assert.equal(opcodeTable.size, 58);
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
  assert.equal(opcodeTable.has("mvp"), false);
  assert.equal(opcodeTable.has("stz"), false);
  assert.equal(opcodeTable.has("bra"), false);
  assert.equal(opcodeTable.has("phx"), false);
  assert.equal(opcodeTable.has("phy"), false);
  assert.equal(opcodeTable.has("plx"), false);
  assert.equal(opcodeTable.has("ply"), false);
  assert.equal(opcodeTable.has("trb"), false);
  assert.equal(opcodeTable.has("tsb"), false);
  assert.equal(opcodeTable.has("bbs"), false);
  assert.equal(opcodeTable.has("bbr"), false);
  assert.equal(opcodeTable.has("rmb"), false);
  assert.equal(opcodeTable.has("smb"), false);
  assert.equal(opcodeTable.has("stp"), false);
  assert.equal(opcodeTable.has("wai"), false);
  assert.equal(opcodeTable.has("pea"), false);
  assert.equal(opcodeTable.has("pei"), false);
  assert.equal(opcodeTable.has("per"), false);
  assert.deepEqual(opcodeTable.get("bge")?.modes, ["relative"]);
  assert.deepEqual(opcodeTable.get("blt")?.modes, ["relative"]);

  assert.equal(directiveTable.get("org")?.supported, true);
  assert.equal(directiveTable.get("dum")?.supported, true);
  assert.equal(directiveTable.get("xc")?.supported, false);
  assert.equal(directiveTable.get("mx")?.supported, false);
  assert.equal(directiveTable.get("put")?.kind, "include");

  assert.equal(directiveTable.size, 47);
  assert.equal(directiveTable.get("pmc")?.supported, true);
  assert.equal(directiveTable.get(">>>")?.supported, true);
  assert.equal(directiveTable.get("lup")?.supported, true);
  assert.equal(directiveTable.get("--^")?.supported, true);
  assert.equal(directiveTable.get("eom")?.supported, false);
  assert.equal(directiveTable.get("<<<")?.supported, false);
}
