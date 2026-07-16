import assert from "node:assert/strict";
import path from "node:path";

import { indexWorkspace } from "../src/asm/workspace";

export function runWorkspaceGraphTest(): void {
  const entryPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-linkscript.S"
  );
  const mainPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-main-6502.S"
  );

  const workspace = indexWorkspace(entryPath, new Map());

  assert.deepEqual(workspace.loadOrder, [entryPath, mainPath]);
  assert.deepEqual(workspace.dependencies.get(entryPath), [mainPath]);
  assert.equal(workspace.documents.has(entryPath), true);
  assert.equal(workspace.documents.has(mainPath), true);

  assert.deepEqual(workspace.symbols.get("TEXT"), {
    name: "TEXT",
    kind: "equate",
    line: 11,
    token: { kind: "label", lexeme: "TEXT", start: 0, end: 4 },
    macroDefinition: null,
    filePath: mainPath
  });

  const missingPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/non-existent.S"
  );
  const emptyWorkspace = indexWorkspace(missingPath, new Map());
  assert.deepEqual(emptyWorkspace.loadOrder, []);
  assert.equal(emptyWorkspace.documents.has(missingPath), false);
}
