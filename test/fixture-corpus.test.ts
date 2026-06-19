import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const validFixturePaths = [
  "test/fixtures/valid/merlin32-linkscript.S",
  "test/fixtures/valid/merlin32-main-6502.S"
];

const invalidFixturePaths = [
  "test/fixtures/invalid/65816-bank-ops.S",
  "test/fixtures/invalid/65816-long-addressing.S"
];

export function runFixtureCorpusTest(): void {
  for (const fixturePath of validFixturePaths) {
    const absolutePath = path.resolve(process.cwd(), fixturePath);
    assert.equal(fs.existsSync(absolutePath), true, `${fixturePath} should exist`);

    const content = fs.readFileSync(absolutePath, "utf8");
    assert.match(content, /Source: apple2accumulator\/merlin32/);
    assert.ok(content.trim().length > 0, `${fixturePath} should not be empty`);
  }

  for (const fixturePath of invalidFixturePaths) {
    const absolutePath = path.resolve(process.cwd(), fixturePath);
    assert.equal(fs.existsSync(absolutePath), true, `${fixturePath} should exist`);

    const content = fs.readFileSync(absolutePath, "utf8");
    assert.match(content, /Source: apple2accumulator\/merlin32/);
    assert.match(content, /65816-only/);
  }
}
