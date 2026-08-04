import assert from "node:assert/strict";

import { parseDocument } from "../src/asm/document";
import { collectWorkspaceDiagnostics, type Diagnostic } from "../src/asm/diagnostics";

export function runLupRegionTest(): void {
  const matchedSource = [
    "        ]v = 0",
    "        lup 4",
    "        ]v = ]v + 1",
    "        db ]v",
    "        --^"
  ].join("\n");
  const matchedDocument = parseDocument(matchedSource);

  assert.equal(matchedDocument.errors.length, 0);
  assert.equal(matchedDocument.loopRegions.length, 1);
  assert.deepEqual(matchedDocument.loopRegions[0], {
    startLine: 1,
    endLine: 4,
    startDirective: { kind: "directive", lexeme: "lup", start: 8, end: 11 },
    endDirective: { kind: "directive", lexeme: "--^", start: 8, end: 11 }
  });

  const matchedDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<loop-matched>", document: matchedDocument }
  ]);
  assert.deepEqual(matchedDiagnostics, []);

  const nestedSource = [
    "        lup 2",
    "        lup 3",
    "        db 0",
    "        --^",
    "        --^",
    "        --^",
    "        lup 1"
  ].join("\n");
  const nestedDocument = parseDocument(nestedSource);

  assert.equal(nestedDocument.errors.length, 0);
  assert.deepEqual(
    nestedDocument.loopRegions.map((region) => ({ start: region.startLine, end: region.endLine })),
    [
      { start: 0, end: 4 },
      { start: 1, end: 3 },
      { start: 6, end: null }
    ]
  );
  assert.deepEqual(
    nestedDocument.unmatchedLoopTerminators.map((terminator) => terminator.line),
    [5]
  );

  const nestedDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<loop-nested>", document: nestedDocument }
  ]);
  assert.equal(
    nestedDiagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.code === "unmatched-loop-terminator" &&
        diagnostic.line === 5 &&
        diagnostic.startCharacter === 8 &&
        diagnostic.endCharacter === 11 &&
        diagnostic.message === "Unmatched loop terminator --^"
    ),
    true
  );
  assert.equal(
    nestedDiagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.code === "unterminated-loop" &&
        diagnostic.line === 6 &&
        diagnostic.startCharacter === 8 &&
        diagnostic.endCharacter === 11 &&
        diagnostic.message === "Unterminated LUP region"
    ),
    true
  );

  const generatedSource = [
    "        lup 2",
    "@loop   nop",
    "        bne @loop",
    "        --^",
    "@orphan equ 1"
  ].join("\n");
  const generatedDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<loop-generated>", document: parseDocument(generatedSource) }
  ]);
  assert.equal(
    generatedDiagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.code === "unsupported-generated-label" &&
        diagnostic.line === 1 &&
        diagnostic.startCharacter === 0 &&
        diagnostic.endCharacter === 5 &&
        diagnostic.message === "Unsupported generated label @loop"
    ),
    true
  );
  assert.equal(
    generatedDiagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.code === "unsupported-generated-label" &&
        diagnostic.line === 4 &&
        diagnostic.message === "Unsupported generated label @orphan"
    ),
    true
  );

  const variableSource = [
    "        ]counter = 0",
    "        lup 4",
    "        ]counter = ]counter + 1",
    "        db ]counter",
    "        --^",
    "        lda ]counter"
  ].join("\n");
  const variableDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<loop-variables>", document: parseDocument(variableSource) }
  ]);
  assert.equal(
    variableDiagnostics.some((diagnostic) => diagnostic.code === "duplicate-symbol"),
    false
  );
  assert.equal(
    variableDiagnostics.some((diagnostic) => diagnostic.code === "unresolved-reference"),
    false
  );

  const unresolvedCountDiagnostics = collectWorkspaceDiagnostics([
    {
      filePath: "<loop-count>",
      document: parseDocument(["        lup MissingCount", "        db 0", "        --^"].join("\n"))
    }
  ]);
  assert.equal(
    unresolvedCountDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "unresolved-reference" &&
        diagnostic.message.includes("MissingCount")
    ),
    true
  );
}
