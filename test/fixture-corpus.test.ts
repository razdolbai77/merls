import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { parseDocument } from "../src/asm/document";
import { collectWorkspaceDiagnostics } from "../src/asm/diagnostics";

const validFixturePaths = [
  "test/fixtures/valid/merlin32-linkscript.S",
  "test/fixtures/valid/merlin32-macro-coverage.S",
  "test/fixtures/valid/merlin32-main-6502.S"
];

const invalidFixturePaths = [
  "test/fixtures/invalid/macro-generated-unresolved.S",
  "test/fixtures/invalid/unknown-bank-ops.S",
  "test/fixtures/invalid/unknown-addressing-modifiers.S"
];

export function runFixtureCorpusTest(): void {
  for (const fixturePath of validFixturePaths) {
    const absolutePath = path.resolve(process.cwd(), fixturePath);
    assert.equal(fs.existsSync(absolutePath), true, `${fixturePath} should exist`);

    const content = fs.readFileSync(absolutePath, "utf8");
    assert.match(content, /Source: apple2accumulator\/merlin32/);
    assert.ok(content.trim().length > 0, `${fixturePath} should not be empty`);

    const document = parseDocument(content);
    assert.deepEqual(document.errors, [], `${fixturePath} should parse without errors`);
    const diagnostics = collectWorkspaceDiagnostics([{ filePath: absolutePath, document }]);
    assert.deepEqual(diagnostics, [], `${fixturePath} should produce no diagnostics`);
  }

  for (const fixturePath of invalidFixturePaths) {
    const absolutePath = path.resolve(process.cwd(), fixturePath);
    assert.equal(fs.existsSync(absolutePath), true, `${fixturePath} should exist`);

    const content = fs.readFileSync(absolutePath, "utf8");
    assert.match(content, /Source: apple2accumulator\/merlin32/);
    if (fixturePath.includes("unknown-")) {
      assert.match(content, /unknown diagnostic coverage/i);
    } else {
      assert.match(content, /macro-generated unresolved reference/);
    }
  }
}
