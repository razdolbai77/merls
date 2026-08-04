import assert from "node:assert/strict";

import { parseDocument } from "../src/asm/document";
import { collectWorkspaceDiagnostics } from "../src/asm/diagnostics";

export function runInvFlsRangeTest(): void {
  const validSource = [
    "        INV \"HELLO WORLD\"",
    "        INV \"ABC 123!?\"",
    "        FLS \"FLASHING TEXT\""
  ].join("\n");
  const validDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<inv-valid>", document: parseDocument(validSource) }
  ]);
  assert.deepEqual(validDiagnostics, []);

  const lowercaseInvDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<inv-lower>", document: parseDocument("        INV \"hello\"") }
  ]);
  assert.equal(
    lowercaseInvDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "invalid-data-operand" &&
        diagnostic.line === 0 &&
        diagnostic.startCharacter === 12 &&
        diagnostic.endCharacter === 19 &&
        diagnostic.message === "INV string contains lowercase characters; inverse text only supports uppercase, digits, and punctuation"
    ),
    true
  );

  const lowercaseFlsDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<fls-lower>", document: parseDocument("        FLS \"abc\"") }
  ]);
  assert.equal(
    lowercaseFlsDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "invalid-data-operand" &&
        diagnostic.message === "FLS string contains lowercase characters; flashing text only supports uppercase, digits, and punctuation"
    ),
    true
  );

  const mixedCaseDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<inv-mixed>", document: parseDocument("        INV \"Hello\"") }
  ]);
  assert.equal(
    mixedCaseDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "invalid-data-operand" &&
        diagnostic.line === 0
    ),
    true
  );

  const unterminatedDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<inv-unterminated>", document: parseDocument("        INV \"hello") }
  ]);
  assert.equal(
    unterminatedDiagnostics.some(
      (diagnostic) => diagnostic.code === "invalid-data-operand" && diagnostic.line === 0
    ),
    true
  );

  const multipleStringDiagnostics = collectWorkspaceDiagnostics([
    {
      filePath: "<inv-multi>",
      document: parseDocument("        INV \"AB\",'cd',\"EF\"")
    }
  ]);
  assert.equal(
    multipleStringDiagnostics.filter(
      (diagnostic) => diagnostic.code === "invalid-data-operand"
    ).length,
    1
  );

  const endBlockedDiagnostics = collectWorkspaceDiagnostics([
    {
      filePath: "<inv-end>",
      document: parseDocument("        end\n        INV \"hello\"")
    }
  ]);
  assert.equal(
    endBlockedDiagnostics.some((diagnostic) => diagnostic.code === "invalid-data-operand"),
    false
  );
}
