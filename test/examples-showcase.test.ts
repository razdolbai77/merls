import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { parseDocument } from "../src/asm/document";
import { collectWorkspaceDiagnostics, type DiagnosticCode } from "../src/asm/diagnostics";

const expectedShowcaseCodes: readonly DiagnosticCode[] = [
  "duplicate-symbol",
  "unresolved-reference",
  "duplicate-macro-definition",
  "invalid-macro-local-label",
  "unsupported-instruction",
  "invalid-addressing-mode",
  "unknown-syntax",
  "missing-macro-end"
];

export function runExamplesShowcaseTest(): void {
  const cleanPath = path.resolve(process.cwd(), "examples/EXAMPLE.S");
  const cleanDocument = parseDocument(fs.readFileSync(cleanPath, "utf8"));
  assert.deepEqual(cleanDocument.errors, [], "examples/EXAMPLE.S should parse without errors");
  assert.deepEqual(
    collectWorkspaceDiagnostics([{ filePath: cleanPath, document: cleanDocument }]),
    [],
    "examples/EXAMPLE.S should be diagnostics-free so users can open it as a clean starter"
  );

  const cleanSource = fs.readFileSync(cleanPath, "utf8");
  assert.equal(
    /\bLSR\s+A\b/i.test(cleanSource),
    false,
    "examples/EXAMPLE.S must use implied LSR, not an explicit A accumulator operand"
  );
  assert.equal(
    /\bSTA\s+\$00\s*,\s*Y\b/i.test(cleanSource),
    false,
    "examples/EXAMPLE.S must not use the invalid direct-page STA $00,Y form"
  );
  assert.equal(
    cleanSource
      .split(/\r?\n/)
      .some((line) => /\b(INV|FLS)\s+['"][^'"]*[a-z]/.test(line)),
    false,
    "examples/EXAMPLE.S INV and FLS payloads must be uppercase"
  );
  assert.equal(
    cleanSource
      .split(/\r?\n/)
      .some((line) => /\bLDA\s+A\b\s*(;|$)/.test(line.trim())),
    false,
    "examples/EXAMPLE.S must not contain the unresolved LDA a reference"
  );
  const codeLines = cleanSource.split(/\r?\n/).map((line) => line.split(";")[0] ?? "");
  assert.equal(
    codeLines.some((line) => /=\s*\*/.test(line)),
    true,
    "examples/EXAMPLE.S should demonstrate the current address * expression"
  );
  assert.equal(
    codeLines.some((line) => /1\+2\*3/.test(line)) &&
      codeLines.some((line) => /\{1\+2\*3\}/.test(line)),
    true,
    "examples/EXAMPLE.S should demonstrate left-to-right and braced precedence"
  );
  assert.equal(
    codeLines.filter((line) => /^\]counter\s*=/.test(line)).length >= 2,
    true,
    "examples/EXAMPLE.S should demonstrate reassignable Merlin variables"
  );
  assert.equal(
    cleanDocument.lines.some(
      (line) =>
        line.node.shape === "macroCall" &&
        line.node.args.some((token) => token.kind === "expressionOperator" && token.lexeme === ";")
    ),
    true,
    "examples/EXAMPLE.S should demonstrate semicolon-separated macro parameters"
  );
  assert.equal(
    cleanDocument.lines.some((line) =>
      line.tokens.some((token) => token.kind !== "comment" && token.lexeme === "]0")
    ),
    true,
    "examples/EXAMPLE.S should demonstrate the ]0 argument-count placeholder"
  );

  const invalidPath = path.resolve(process.cwd(), "examples/DIAGNOSTICS.S");
  const invalidDocument = parseDocument(fs.readFileSync(invalidPath, "utf8"));
  const invalidDiagnostics = collectWorkspaceDiagnostics([
    { filePath: invalidPath, document: invalidDocument }
  ]);
  const invalidCodes = new Set(invalidDiagnostics.map((diagnostic) => diagnostic.code));
  for (const expectedCode of expectedShowcaseCodes) {
    assert.equal(
      invalidCodes.has(expectedCode),
      true,
      `examples/DIAGNOSTICS.S should demonstrate ${expectedCode}`
    );
  }
}
