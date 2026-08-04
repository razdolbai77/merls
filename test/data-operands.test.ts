import assert from "node:assert/strict";

import { parseDocument } from "../src/asm/document";
import { collectWorkspaceDiagnostics } from "../src/asm/diagnostics";
import { parseSourceLines } from "../src/asm/parser";

export function runDataOperandTest(): void {
  const dsLine = parseSourceLines("        DS 8,$EE")[0];
  assert.equal(dsLine?.shape, "directive");
  if (dsLine?.shape === "directive") {
    assert.deepEqual(dsLine.operand, { kind: "numericLiteral", value: "8" });
    assert.deepEqual(dsLine.additionalOperands, [{ kind: "numericLiteral", value: "$EE" }]);
  }

  const dsSingleLine = parseSourceLines("dum0    ds  1")[0];
  assert.equal(dsSingleLine?.shape, "directive");
  if (dsSingleLine?.shape === "directive") {
    assert.deepEqual(dsSingleLine.operand, { kind: "numericLiteral", value: "1" });
    assert.equal(dsSingleLine.additionalOperands, undefined);
  }

  const dsContinuationLine = parseSourceLines("        DS \\,$A0")[0];
  assert.equal(dsContinuationLine?.shape, "directive");
  if (dsContinuationLine?.shape === "directive") {
    assert.equal(dsContinuationLine.operand?.kind, "identifier");
    assert.deepEqual(dsContinuationLine.additionalOperands, [{ kind: "numericLiteral", value: "$A0" }]);
  }

  const validSource = [
    "        DS 8,$EE",
    "        DS 4",
    "        DS \\,$A0",
    "        ASC \"AB\",$8D,\"CD\"",
    "COUNT   EQU 8",
    "        DS COUNT,$00"
  ].join("\n");
  const validDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<data-valid>", document: parseDocument(validSource) }
  ]);
  assert.deepEqual(validDiagnostics, []);

  const orphanContinuationDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<data-orphan>", document: parseDocument("        DS \\,$A0") }
  ]);
  assert.equal(
    orphanContinuationDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "invalid-data-operand" &&
        diagnostic.message === "DS continuation \\ requires a preceding DS line"
    ),
    true
  );

  const tooManyOperandsDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<data-too-many>", document: parseDocument("        DS 1,2,3") }
  ]);
  assert.equal(
    tooManyOperandsDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "invalid-data-operand" &&
        diagnostic.message === "DS accepts at most two operands: count and optional fill"
    ),
    true
  );

  const emptySegmentDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<data-empty>", document: parseDocument("        ASC \"AB\",,\"CD\"") }
  ]);
  assert.equal(
    emptySegmentDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "invalid-data-operand" &&
        diagnostic.message === "Empty ASC operand segment"
    ),
    true
  );

  const trailingSegmentDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<data-trailing>", document: parseDocument("        ASC \"AB\",") }
  ]);
  assert.equal(
    trailingSegmentDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "invalid-data-operand" &&
        diagnostic.message === "Empty ASC operand segment"
    ),
    true
  );

  const unresolvedFillDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<data-fill>", document: parseDocument("        DS 8,MISSING") }
  ]);
  assert.equal(
    unresolvedFillDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "unresolved-reference" &&
        diagnostic.message.includes("MISSING")
    ),
    true
  );
}
