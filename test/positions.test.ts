import assert from "node:assert/strict";
import { positionOf, positionOfInMatch, positionOfLast } from "./helpers/positions";

export function runPositionsTest(): void {
  const text = "alpha\nbeta alpha\nomega";

  assert.deepEqual(positionOf(text, "alpha"), { line: 0, character: 0 });
  assert.deepEqual(positionOfLast(text, "alpha"), { line: 1, character: 5 });
  assert.deepEqual(positionOfInMatch(text, "beta", 2), { line: 1, character: 2 });
}
