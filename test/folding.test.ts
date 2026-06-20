import assert from "node:assert/strict";
import { FoldingRangeKind } from "vscode-languageserver/node";
import { buildCachedDocument } from "../src/asm/document";
import { buildFoldingRanges } from "../src/lsp/folding";

export function runFoldingTest(): void {
  const source = `
* line 1
* line 2
* line 3

label mac
  lda #0
  eom

  hex 00
  hex 01
  hex 02

  rts
`;

  const cached = buildCachedDocument(source);
  const ranges = buildFoldingRanges(cached);

  assert.equal(ranges.length, 3);

  // Comments (lines 1, 2, 3) are at index 1, 2, 3
  const commentRange = ranges.find((r) => r.kind === FoldingRangeKind.Comment);
  assert.ok(commentRange);
  assert.equal(commentRange.startLine, 1);
  assert.equal(commentRange.endLine, 3);

  // Macro (lines 5, 6, 7)
  const macroRange = ranges.find((r) => r.kind === FoldingRangeKind.Region && r.startLine === 5);
  assert.ok(macroRange);
  assert.equal(macroRange.endLine, 7);

  // Data (lines 9, 10, 11)
  const dataRange = ranges.find((r) => r.kind === FoldingRangeKind.Region && r.startLine === 9);
  assert.ok(dataRange);
  assert.equal(dataRange.endLine, 11);
}
