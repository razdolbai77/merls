import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const staleModulePaths = [
  "src/asm/substitution.ts",
  "test/substitution.test.ts"
];

export function runDocConsistencyTest(): void {
  for (const docPath of ["README.md", "AGENTS.md"]) {
    const absolutePath = path.resolve(process.cwd(), docPath);
    const content = fs.readFileSync(absolutePath, "utf8");

    for (const stalePath of staleModulePaths) {
      assert.equal(
        content.includes(stalePath),
        false,
        `${docPath} must not reference the nonexistent ${stalePath}`
      );
    }
  }

  for (const stalePath of staleModulePaths) {
    assert.equal(
      fs.existsSync(path.resolve(process.cwd(), stalePath)),
      false,
      `${stalePath} must stay absent while docs describe expandMacroCall as the substitution home`
    );
  }
}
