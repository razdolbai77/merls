import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type CocSettings = {
  languageserver?: {
    merls?: {
      command?: string;
      args?: string[];
      filetypes?: string[];
      rootPatterns?: string[];
    };
  };
};

export function runCocConfigTest(): void {
  const settingsPath = path.resolve(process.cwd(), "examples/coc-settings.json");
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as CocSettings;
  const serverConfig = settings.languageserver?.merls;

  assert.equal(serverConfig?.command, "merls");
  assert.deepEqual(serverConfig?.args, [
    "--stdio"
  ]);
  assert.deepEqual(serverConfig?.filetypes, ["asm", "6502"]);
  assert.deepEqual(serverConfig?.rootPatterns, [".git", "package.json"]);
}
