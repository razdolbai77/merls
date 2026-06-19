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
    "        dsk ../build/WORLD",
    "        typ BIN",
    "        typ BLAH",
    "        end BLAH"
  ].join("\n");

  const bankOpsPath = path.resolve(
    process.cwd(),
    "test/fixtures/invalid/65816-bank-ops.asm"
  );
  const longPath = path.resolve(
    process.cwd(),
    "test/fixtures/invalid/65816-long-addressing.asm"
  );

  const diagnostics = collectWorkspaceDiagnostics([
    {
      filePath: "<memory>",
      document: parseDocument(duplicateSource)
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
