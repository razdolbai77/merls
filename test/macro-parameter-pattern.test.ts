import assert from "node:assert/strict";

import { macroParameterPattern } from "../src/asm/macros";

export function runMacroParameterPatternTest(): void {
  assert.equal(macroParameterPattern.test("]0"), true);
  assert.equal(macroParameterPattern.test("]1"), true);
  assert.equal(macroParameterPattern.test("]12"), true);
  assert.equal(macroParameterPattern.test("]x"), false);
  assert.equal(macroParameterPattern.test("]1x"), false);
  assert.equal(macroParameterPattern.test("x]1"), false);
  assert.equal(macroParameterPattern.test(""), false);

  const match = macroParameterPattern.exec("]7");
  assert.equal(match?.[1], "7");
  assert.equal(macroParameterPattern.unicode, true);
}
