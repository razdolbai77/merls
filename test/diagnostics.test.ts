import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { parseDocument } from "../src/asm/document";
import {
  collectWorkspaceDiagnostics,
  type Diagnostic
} from "../src/asm/diagnostics";

export function runDiagnosticsTest(): void {
  const duplicateSource = [
    "dup     equ 1",
    "        lda missing",
    "        hex 8D",
    "        hex 00,01,02,03",
    "        hex 0001,0203",
    "        hex fg",
    "        hex F",
    "        lda 8D",
    "dup     equ 2",
    "        adc (",
    "        DSK ../build/WORLD",
    "        TYP BIN",
    "        TYP BLAH",
    "        end BLAH",
    "        dex #10",
    "        lda ($10),x"
  ].join("\n");
  const macroSource = [
    "FirstMac mac",
    "        lda ]1",
    "        sta ]2",
    "SecondMac mac",
    "        lda ]1",
    "        eom",
    "        eom",
    "FirstMac mac",
    "        eom",
    "        MissingMac VALUE",
    "        FirstMac VALUE",
    "        SecondMac",
    "ZeroMac  mac",
    "        eom",
    "        ZeroMac VALUE",
    "        FirstMac VALUE;OTHER",
    "LocalLabelMac mac",
    ":local",
    "        jmp :local",
    "        eom",
    "UnclosedMac mac",
    "        lda ]1"
  ].join("\n");

  const bankOpsPath = path.resolve(
    process.cwd(),
    "test/fixtures/invalid/unknown-bank-ops.S"
  );
  const longPath = path.resolve(
    process.cwd(),
    "test/fixtures/invalid/unknown-addressing-modifiers.S"
  );
  const mainFixturePath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-main-6502.S"
  );

  const diagnostics = collectWorkspaceDiagnostics([
    {
      filePath: "<memory>",
      document: parseDocument(duplicateSource)
    },
    {
      filePath: "<macro>",
      document: parseDocument(macroSource)
    },
    {
      filePath: bankOpsPath,
      document: parseDocument(fs.readFileSync(bankOpsPath, "utf8"))
    },
    {
      filePath: longPath,
      document: parseDocument(fs.readFileSync(longPath, "utf8"))
    }
  ]);

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "duplicate-symbol" &&
        diagnostic.line === 8
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "missing-macro-end" &&
        diagnostic.line === 20 &&
        diagnostic.message.includes("UnclosedMac")
    ),
    true
  );


  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "invalid-macro-local-label" &&
        diagnostic.line === 17 &&
        diagnostic.message.includes("cannot be used inside macros")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "invalid-macro-local-label" &&
        diagnostic.line === 18 &&
        diagnostic.message.includes("cannot be used inside macros")
    ),
    true
  );



  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "duplicate-macro-definition" &&
        diagnostic.line === 7 &&
        diagnostic.message.includes("FirstMac")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "unsupported-instruction" &&
        diagnostic.line === 9 &&
        diagnostic.message.includes("MissingMac")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "macro-arity-mismatch" &&
        diagnostic.line === 10 &&
        diagnostic.message.includes("expected 2")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "unsupported-instruction" &&
        diagnostic.line === 11 &&
        diagnostic.message.includes("SecondMac")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "macro-arity-mismatch" &&
        diagnostic.line === 14 &&
        diagnostic.message.includes("expected 0")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "macro-arity-mismatch" &&
        diagnostic.line === 15
    ),
    false
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "unresolved-reference" &&
        diagnostic.line === 1 &&
        diagnostic.message.includes("missing")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "unresolved-reference" &&
        diagnostic.line === 2 &&
        diagnostic.message.includes("8D")
    ),
    false
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "unknown-syntax" &&
        diagnostic.line === 3
    ),
    false
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "unknown-syntax" &&
        diagnostic.line === 4
    ),
    false
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "unknown-syntax" &&
        diagnostic.line === 5 &&
        diagnostic.message.includes("fg")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "unresolved-reference" &&
        diagnostic.line === 5 &&
        diagnostic.message.includes("fg")
    ),
    false
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "unknown-syntax" &&
        diagnostic.line === 6 &&
        diagnostic.message.includes("F")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "unresolved-reference" &&
        diagnostic.line === 7 &&
        diagnostic.message.includes("8D")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "unresolved-reference" &&
        diagnostic.line === 8
    ),
    false
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "unresolved-reference" &&
        (diagnostic.line === 9 || diagnostic.line === 10)
    ),
    false
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "unresolved-reference" &&
        diagnostic.line === 12 &&
        diagnostic.message.includes("BLAH")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "malformed-line" &&
        diagnostic.line === 9
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "malformed-line" &&
        diagnostic.line === 13 &&
        diagnostic.message === "unexpected operand for end"
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === bankOpsPath &&
        diagnostic.code === "unsupported-instruction" &&
        diagnostic.message.includes("mvn")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === longPath &&
        diagnostic.code === "unknown-syntax" &&
        diagnostic.message.includes("^")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "invalid-addressing-mode" &&
        diagnostic.line === 14 &&
        diagnostic.message.includes("dex")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "invalid-addressing-mode" &&
        diagnostic.line === 15 &&
        diagnostic.message.includes("lda")
    ),
    true
  );
  const mainFixtureDocument = parseDocument(fs.readFileSync(mainFixturePath, "utf8"));
  const mainFixtureDiagnostics = collectWorkspaceDiagnostics([
    {
      filePath: mainFixturePath,
      document: mainFixtureDocument
    }
  ]);
  assert.equal(mainFixtureDocument.errors.length, 0);
  assert.equal(
    mainFixtureDiagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.code === "unresolved-reference" &&
        diagnostic.message.includes("dumSize")
    ),
    false
  );

  // Equate operands participate in unresolved-reference analysis.
  const equateSource = [
    "Defined equ 1",
    "Alias   equ Defined",
    "Broken  equ MissingEqu"
  ].join("\n");
  const equateDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<equate>", document: parseDocument(equateSource) }
  ]);
  assert.equal(
    equateDiagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<equate>" &&
        diagnostic.code === "unresolved-reference" &&
        diagnostic.line === 2 &&
        diagnostic.message.includes("MissingEqu")
    ),
    true,
    "expected the equate operand reference to be diagnosed"
  );
  assert.equal(
    equateDiagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<equate>" &&
        diagnostic.message.includes("Defined")
    ),
    false,
    "expected the resolved equate operand to produce no diagnostic"
  );

  const forwardUseDiagnostics = collectWorkspaceDiagnostics([
    {
      filePath: "<first>",
      document: parseDocument([
        "        LaterMacro",
        "        lda LaterEquate",
        "        bne LaterLabel"
      ].join("\n"))
    },
    {
      filePath: "<second>",
      document: parseDocument([
        "LaterLabel nop",
        "LaterEquate equ 1",
        "LaterMacro mac",
        "        eom"
      ].join("\n"))
    }
  ]);
  assert.equal(
    forwardUseDiagnostics.some(
      (diagnostic) =>
        diagnostic.filePath === "<first>" &&
        diagnostic.code === "forward-macro-call" &&
        diagnostic.message === "Macro LaterMacro must be defined before use"
    ),
    true,
    "expected a forward macro call diagnostic"
  );
  assert.equal(
    forwardUseDiagnostics.some(
      (diagnostic) =>
        diagnostic.filePath === "<first>" &&
        diagnostic.code === "forward-equate-reference" &&
        diagnostic.message === "EQU symbol LaterEquate must be defined before use"
    ),
    true,
    "expected a forward EQU reference diagnostic"
  );
  assert.equal(
    forwardUseDiagnostics.some(
      (diagnostic) => diagnostic.filePath === "<first>" && diagnostic.message.includes("LaterLabel")
    ),
    false,
    "expected forward ordinary labels to remain valid"
  );
}
