import assert from "node:assert/strict";

import { parseDocument } from "../src/asm/document";
import { collectWorkspaceDiagnostics, type Diagnostic } from "../src/asm/diagnostics";

export function runMacroDiagnosticsTest(): void {
  const source = [
    "FirstMac mac",
    "        lda ]1",
    "        sta ]2",
    "SecondMac mac",
    "        lda ]1",
    "        eom",
    "FirstMac mac",
    "        eom",
    "        MissingMac VALUE",
    "        FirstMac VALUE",
    "        SecondMac",
    "ZeroMac  mac",
    "        eom",
    "        ZeroMac VALUE",
    "UnclosedMac mac",
    "        lda ]1"
  ].join("\n");

  const diagnostics = collectWorkspaceDiagnostics([
    {
      filePath: "<macro-ranges>",
      document: parseDocument(source)
    }
  ]);

  assert.deepEqual(findDiagnostic(diagnostics, "invalid-macro-nesting", 3), {
    filePath: "<macro-ranges>",
    line: 3,
    code: "invalid-macro-nesting",
    message: "Macro SecondMac cannot be defined inside macro FirstMac",
    startCharacter: 0,
    endCharacter: 9
  });

  assert.deepEqual(findDiagnostic(diagnostics, "duplicate-macro-definition", 6), {
    filePath: "<macro-ranges>",
    line: 6,
    code: "duplicate-macro-definition",
    message: "Duplicate macro definition FirstMac; first defined at line 0",
    startCharacter: 0,
    endCharacter: 8
  });

  assert.deepEqual(findDiagnostic(diagnostics, "unresolved-macro", 8), {
    filePath: "<macro-ranges>",
    line: 8,
    code: "unresolved-macro",
    message: "Unresolved macro MissingMac",
    startCharacter: 8,
    endCharacter: 18
  });

  assert.deepEqual(findDiagnostic(diagnostics, "macro-arity-mismatch", 9), {
    filePath: "<macro-ranges>",
    line: 9,
    code: "macro-arity-mismatch",
    message: "Macro FirstMac expected 2 argument(s) but received 1",
    startCharacter: 8,
    endCharacter: 16
  });

  assert.deepEqual(findDiagnostic(diagnostics, "missing-macro-end", 14), {
    filePath: "<macro-ranges>",
    line: 14,
    code: "missing-macro-end",
    message: "Macro UnclosedMac is missing a closing eom/<<<",
    startCharacter: 0,
    endCharacter: 11
  });
}

function findDiagnostic(
  diagnostics: readonly Diagnostic[],
  code: Diagnostic["code"],
  line: number
): Diagnostic | undefined {
  return diagnostics.find((diagnostic) => diagnostic.code === code && diagnostic.line === line);
}
