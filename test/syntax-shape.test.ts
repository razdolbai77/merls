import assert from "node:assert/strict";

import {
  lineShapeTable,
  tokenKindTable
} from "../src/asm/syntax";

export function runSyntaxShapeTest(): void {
  assert.equal(tokenKindTable.get("comment")?.captureExamples[0], "; trailing note");
  assert.equal(tokenKindTable.get("localLabel")?.captureExamples[0], "]loop");
  assert.equal(tokenKindTable.get("modifier")?.captureExamples.includes("<value"), true);
  assert.equal(tokenKindTable.has("expressionOperator"), true);

  assert.equal(lineShapeTable.get("instruction")?.allowsLabel, true);
  assert.equal(lineShapeTable.get("directive")?.requiresOperand, false);
  assert.equal(lineShapeTable.get("equate")?.allowsExpression, true);
  assert.equal(lineShapeTable.get("malformed")?.terminal, true);
}
