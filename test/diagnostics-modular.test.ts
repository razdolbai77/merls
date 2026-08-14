import assert from "node:assert/strict";

import { parseDocument } from "../src/asm/document";
import { collectActiveLines } from "../src/asm/diagnostics/expressions";
import { collectDuplicateSymbolDiagnostics } from "../src/asm/diagnostics/labels";
import { collectMalformedDiagnostics } from "../src/asm/diagnostics/general";

export function runModularDiagnosticsTest(): void {
  // Test modular expression evaluation & active lines
  const condDoc = parseDocument(
    [
      "        DO 1",
      "        lda #0",
      "        ELSE",
      "        lda #1",
      "        FIN"
    ].join("\n")
  );
  const values = new Map<string, number>();
  const activeLines = collectActiveLines(condDoc, values);
  assert.ok(activeLines.has(1));
  assert.ok(!activeLines.has(3));

  // Test modular label diagnostics
  const duplicates = collectDuplicateSymbolDiagnostics([
    { name: "FOO", line: 1, filePath: "a.S", startCharacter: 0, endCharacter: 3 },
    { name: "FOO", line: 2, filePath: "a.S", startCharacter: 0, endCharacter: 3 }
  ]);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0]?.code, "duplicate-symbol");

  // Test modular general diagnostics
  const malformedDoc = parseDocument("        = 123");
  const malformed = collectMalformedDiagnostics("a.S", malformedDoc);
  assert.equal(malformed.length, 1);
  assert.equal(malformed[0]?.code, "malformed-line");
}
