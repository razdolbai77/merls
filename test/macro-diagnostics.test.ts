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

  const separatorDiagnostics = collectWorkspaceDiagnostics([
    {
      filePath: "<macro-separator>",
      document: parseDocument([
        "Move mac",
        "        lda ]1",
        "        sta ]2",
        "        eom",
        "        Move #$00;$02"
      ].join("\n"))
    }
  ]);
  assert.equal(
    separatorDiagnostics.some((diagnostic) => diagnostic.code === "macro-arity-mismatch"),
    false
  );

  const countDiagnostics = collectWorkspaceDiagnostics([
    {
      filePath: "<macro-argument-count>",
      document: parseDocument([
        "CountArgs mac",
        "        dfb ]0",
        "        eom",
        "        CountArgs",
        "        CountArgs VALUE",
        "        CountArgs A;B;C;D;E;F;G;H"
      ].join("\n"))
    }
  ]);
  assert.equal(
    countDiagnostics.some((diagnostic) => diagnostic.code === "macro-arity-mismatch"),
    false
  );

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

  // Expanded diagnostics must not carry macro-body columns onto call-site lines.
  {
    const overflowSource = [
      "Wrap mac",
      "        lda ^dp",
      "        eom",
      "dp      equ $10",
      "  Wrap"
    ].join("\n");
    const overflowDiagnostics = collectWorkspaceDiagnostics([
      { filePath: "<overflow>", document: parseDocument(overflowSource) }
    ]);
    const overflowLines = overflowSource.split("\n");

    for (const diagnostic of overflowDiagnostics) {
      const lineLength = overflowLines[diagnostic.line]?.length ?? 0;
      const startCharacter = diagnostic.startCharacter ?? 0;
      const endCharacter = diagnostic.endCharacter ?? lineLength;
      assert.ok(
        startCharacter >= 0 && startCharacter <= lineLength,
        `expected startCharacter within line for ${diagnostic.code} at ${diagnostic.line}`
      );
      assert.ok(
        endCharacter >= startCharacter && endCharacter <= lineLength,
        `expected endCharacter within line for ${diagnostic.code} at ${diagnostic.line}`
      );
    }

    // The macro body line itself keeps its unknown-syntax diagnostic.
    assert.deepEqual(findDiagnostic(overflowDiagnostics, "unknown-syntax", 1), {
      filePath: "<overflow>",
      line: 1,
      code: "unknown-syntax",
      message: "Unknown syntax: ^",
      startCharacter: 12,
      endCharacter: 13
    });

    // The expanded copy on the call-site line must not be reported again.
    assert.equal(
      overflowDiagnostics.some(
        (diagnostic) => diagnostic.code === "unknown-syntax" && diagnostic.line === 4
      ),
      false
    );
  }

  // Argument-derived unresolved references map to call-site columns.
  {
    const argSource = [
      "Wrap mac",
      "        sta ]1",
      "        eom",
      "  Wrap Missing"
    ].join("\n");
    const argDiagnostics = collectWorkspaceDiagnostics([
      { filePath: "<args>", document: parseDocument(argSource) }
    ]);
    assert.deepEqual(findDiagnostic(argDiagnostics, "unresolved-reference", 3), {
      filePath: "<args>",
      line: 3,
      code: "unresolved-reference",
      message: "Unresolved reference Missing",
      startCharacter: 7,
      endCharacter: 14
    });
  }

  // jmp (abs,x) is accepted; jmp #$1000 stays invalid.
  {
    const addressingSource = [
      "abs",
      "        jmp (abs,x)",
      "        jmp #$1000"
    ].join("\n");
    const addressingDiagnostics = collectWorkspaceDiagnostics([
      { filePath: "<addressing>", document: parseDocument(addressingSource) }
    ]);
    assert.equal(
      addressingDiagnostics.some(
        (diagnostic) =>
          diagnostic.code === "invalid-addressing-mode" && diagnostic.line === 1
      ),
      false
    );
    assert.equal(
      addressingDiagnostics.some(
        (diagnostic) =>
          diagnostic.code === "invalid-addressing-mode" && diagnostic.line === 2
      ),
      true
    );
  }

  // getUnknownTextPattern never emits negative columns.
  {
    const textPatternSource = [
      "        lda ^dp",
      "        lda |dp",
      "        lda >dp"
    ].join("\n");
    const textPatternDiagnostics = collectWorkspaceDiagnostics([
      { filePath: "<text-pattern>", document: parseDocument(textPatternSource) }
    ]);
    for (const diagnostic of textPatternDiagnostics) {
      if (diagnostic.startCharacter !== undefined) {
        assert.ok(diagnostic.startCharacter >= 0, "startCharacter must never be negative");
      }
      if (diagnostic.endCharacter !== undefined) {
        assert.ok(diagnostic.endCharacter >= 0, "endCharacter must never be negative");
      }
    }
  }
}

function findDiagnostic(
  diagnostics: readonly Diagnostic[],
  code: Diagnostic["code"],
  line: number
): Diagnostic | undefined {
  return diagnostics.find((diagnostic) => diagnostic.code === code && diagnostic.line === line);
}
