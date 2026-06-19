import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const validFixturePaths = [
  "test/fixtures/valid/merlin32-linkscript.asm",
  "test/fixtures/valid/merlin32-main-6502.asm"
];

export function runFixtureCorpusTest(): void {
  for (const fixturePath of validFixturePaths) {
    const absolutePath = path.resolve(process.cwd(), fixturePath);
    assert.equal(fs.existsSync(absolutePath), true, `${fixturePath} should exist`);

    const content = fs.readFileSync(absolutePath, "utf8");
    assert.match(content, /Source: apple2accumulator\/merlin32/);
    assert.ok(content.trim().length > 0, `${fixturePath} should not be empty`);
  }
}
