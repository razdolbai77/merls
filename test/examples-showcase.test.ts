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
