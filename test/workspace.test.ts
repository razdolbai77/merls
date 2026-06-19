import assert from "node:assert/strict";
import path from "node:path";

import { indexWorkspace } from "../src/asm/workspace";

export function runWorkspaceGraphTest(): void {
  const entryPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-linkscript.asm"
  );
  const mainPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-main-6502.asm"
  );

  const workspace = indexWorkspace(entryPath);

  assert.deepEqual(workspace.loadOrder, [entryPath, mainPath]);
  assert.deepEqual(workspace.dependencies.get(entryPath), [mainPath]);
  assert.equal(workspace.documents.has(entryPath), true);
  assert.equal(workspace.documents.has(mainPath), true);

  assert.deepEqual(workspace.symbols.get("TEXT"), {
    name: "TEXT",
    kind: "equate",
    line: 11,
    filePath: mainPath
  });
}
