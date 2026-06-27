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
    "dup     equ 2",
    "        adc (",
    "        DSK ../build/WORLD",
    "        TYP BIN",
    "        TYP BLAH",
    "        end BLAH"
  ].join("\n");
  const macroSource = [
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
    "        FirstMac VALUE,OTHER",
    "LocalLabelMac mac",
    ":local",
    "        jmp :local",
    "        eom",
    "UnclosedMac mac",
    "        lda ]1"
  ].join("\n");

  const bankOpsPath = path.resolve(
    process.cwd(),
    "test/fixtures/invalid/65816-bank-ops.S"
  );
  const longPath = path.resolve(
    process.cwd(),
    "test/fixtures/invalid/65816-long-addressing.S"
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
        diagnostic.line === 2
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "missing-macro-end" &&
        diagnostic.line === 19 &&
        diagnostic.message.includes("UnclosedMac")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "invalid-macro-nesting" &&
        diagnostic.line === 3 &&
        diagnostic.message.includes("SecondMac")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "invalid-macro-local-label" &&
        diagnostic.line === 16 &&
        diagnostic.message.includes("cannot be used inside macros")
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
        diagnostic.code === "duplicate-macro-definition" &&
        diagnostic.line === 6 &&
        diagnostic.message.includes("FirstMac")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "unresolved-macro" &&
        diagnostic.line === 8 &&
        diagnostic.message.includes("MissingMac")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "macro-arity-mismatch" &&
        diagnostic.line === 9 &&
        diagnostic.message.includes("expected 2")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "macro-arity-mismatch" &&
        diagnostic.line === 10 &&
        diagnostic.message.includes("expected 1")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "macro-arity-mismatch" &&
        diagnostic.line === 13 &&
        diagnostic.message.includes("expected 0")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<macro>" &&
        diagnostic.code === "macro-arity-mismatch" &&
        diagnostic.line === 14
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
        (diagnostic.line === 4 || diagnostic.line === 5)
    ),
    false
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "unresolved-reference" &&
        diagnostic.line === 6 &&
        diagnostic.message.includes("BLAH")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "malformed-line" &&
        diagnostic.line === 3
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === "<memory>" &&
        diagnostic.code === "malformed-line" &&
        diagnostic.line === 7 &&
        diagnostic.message === "unexpected operand for end"
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === bankOpsPath &&
        diagnostic.code === "unsupported-65816" &&
        diagnostic.message.includes("mvn")
    ),
    true
  );

  assert.equal(
    diagnostics.some(
      (diagnostic: Diagnostic) =>
        diagnostic.filePath === longPath &&
        diagnostic.code === "unsupported-65816" &&
        diagnostic.message.includes("^")
    ),
    true
  );
}
