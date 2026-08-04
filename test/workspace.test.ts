import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildCachedDocument, CachedDocument } from "../src/asm/document";
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

export function runWorkspaceCaseInsensitiveLookupTest(): void {
  if (process.platform !== "win32") {
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "merls-workspace-case-"));
  const libPath = path.join(tempDir, "lib.S");
  const mainPath = path.join(tempDir, "main.S");
  const upperIncludePath = path.join(tempDir, "LIB.S");

  fs.writeFileSync(libPath, "DiskLib equ 1\n");
  fs.writeFileSync(mainPath, "  asm \"LIB.S\"\n");

  try {
    // An open buffer must win over stale disk content when the include
    // directive spells the same file with different letter case.
    const overrides = new Map<string, CachedDocument>([
      [libPath, buildCachedDocument("BufferLib equ 2\n")]
    ]);
    const overrideWorkspace = indexWorkspace(mainPath, new Map(), overrides);
    assert.equal(
      overrideWorkspace.symbols.has("BufferLib"),
      true,
      "expected the case-mismatched include to resolve to the open buffer"
    );
    assert.equal(
      overrideWorkspace.symbols.has("DiskLib"),
      false,
      "case-mismatched include must not fall back to stale disk content"
    );

    // A diskCache entry must win over a disk read when the include
    // directive spells the same file with different letter case.
    const diskCache = new Map<string, CachedDocument>([
      [libPath, buildCachedDocument("CachedLib equ 3\n")]
    ]);
    const cacheWorkspace = indexWorkspace(mainPath, diskCache);
    assert.equal(
      cacheWorkspace.symbols.has("CachedLib"),
      true,
      "expected the case-mismatched include to resolve to the cached document"
    );
    assert.equal(
      cacheWorkspace.symbols.has("DiskLib"),
      false,
      "case-mismatched include must not re-read the disk when a cache entry exists"
    );
    assert.equal(cacheWorkspace.documents.get(upperIncludePath), diskCache.get(libPath));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
