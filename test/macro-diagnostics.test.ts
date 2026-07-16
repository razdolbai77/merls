import assert from "node:assert/strict";

import { parseDocument } from "../src/asm/document";
import { MAX_MACRO_EXPANSION_DEPTH } from "../src/asm/limits";
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
    "RecurseMac mac",
    "        RecurseMac VALUE",
    "        eom",
    "PastedMac mac",
    "        lda label]1",
    "        do 1",
    "        fin",
    "        eom",
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
    message: "Duplicate macro definition FirstMac; first defined at line 1",
    startCharacter: 0,
    endCharacter: 8
  });

  assert.deepEqual(findDiagnostic(diagnostics, "unsupported-instruction", 8), {
    filePath: "<macro-ranges>",
    line: 8,
    code: "unsupported-instruction",
    message: "Unsupported instruction or undefined macro: MissingMac",
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

  assert.deepEqual(findDiagnostic(diagnostics, "missing-macro-end", 22), {
    filePath: "<macro-ranges>",
    line: 22,
    code: "missing-macro-end",
    message: "Macro UnclosedMac is missing a closing eom/<<<",
    startCharacter: 0,
    endCharacter: 11
  });

  assert.deepEqual(findDiagnostic(diagnostics, "macro-recursion", 15), {
    filePath: "<macro-ranges>",
    line: 15,
    code: "macro-recursion",
    message: "Recursive macro call detected for RecurseMac",
    startCharacter: 8,
    endCharacter: 18
  });

  assert.deepEqual(findDiagnostic(diagnostics, "token-pasted-name", 18), {
    filePath: "<macro-ranges>",
    line: 18,
    code: "token-pasted-name",
    message: "Unsupported token-pasted name label]1",
    startCharacter: 12,
    endCharacter: 19
  });

  assert.deepEqual(findDiagnostic(diagnostics, "unresolved-conditional", 19), {
    filePath: "<macro-ranges>",
    line: 19,
    code: "unresolved-conditional",
    message: "Conditional assembly directive do inside macro cannot be statically resolved",
    startCharacter: 8,
    endCharacter: 10
  });

  const deepMacroLines: string[] = [];
  for (let index = 0; index <= MAX_MACRO_EXPANSION_DEPTH; index++) {
    deepMacroLines.push(`Macro${index} mac`);
    deepMacroLines.push(
      index === MAX_MACRO_EXPANSION_DEPTH ? "        nop" : `        Macro${index + 1}`
    );
    deepMacroLines.push("        eom");
  }
  deepMacroLines.push("        Macro0");

  const deepDiagnostics = collectWorkspaceDiagnostics([
    {
      filePath: "<deep-macro-expansion>",
      document: parseDocument(deepMacroLines.join("\n"))
    }
  ]);
  assert.equal(
    deepDiagnostics.some((diagnostic) => diagnostic.code === "deep-macro-expansion"),
    true,
    `Expected macro expansion to stop at depth ${MAX_MACRO_EXPANSION_DEPTH}`
  );
}

function findDiagnostic(
  diagnostics: readonly Diagnostic[],
  code: Diagnostic["code"],
  line: number
): Diagnostic | undefined {
  return diagnostics.find((diagnostic) => diagnostic.code === code && diagnostic.line === line);
}
