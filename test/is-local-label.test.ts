import assert from "node:assert/strict";

import { isLocalLabel } from "../src/asm/local-labels";

export function runIsLocalLabelTest(): void {
  assert.equal(isLocalLabel("]loop"), true);
  assert.equal(isLocalLabel(":good"), true);
  assert.equal(isLocalLabel("GetKey"), false);
  assert.equal(isLocalLabel("_tmp"), false);
  assert.equal(isLocalLabel("]"), true);
  assert.equal(isLocalLabel(":"), true);
}
