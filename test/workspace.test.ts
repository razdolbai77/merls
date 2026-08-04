import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildCachedDocument, CachedDocument, parseDocument } from "../src/asm/document";
import { indexWorkspace, readIncludeTarget } from "../src/asm/workspace";

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

export function runUntitledWorkspaceTest(): void {
  const entryUri = "untitled:Untitled-1";
  const overrides = new Map<string, CachedDocument>([
    [entryUri, buildCachedDocument('  asm "dependency.S"\n')]
  ]);

  const workspace = indexWorkspace(entryUri, new Map(), overrides);

  assert.deepEqual(workspace.loadOrder, [entryUri]);
  assert.deepEqual(workspace.dependencies.get(entryUri), []);
  assert.equal(workspace.documents.has(entryUri), true);
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

export function runMacroFolderUseTest(): void {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "merls-macro-folder-"));
  const macroFolder = path.join(tempDir, "MerlinMacros");
  const entryPath = path.join(tempDir, "main.S");
  const macroPath = path.join(macroFolder, "Int.Macs.s");
  fs.mkdirSync(macroFolder);
  fs.writeFileSync(entryPath, "        use 4/Int.Macs\n");
  fs.writeFileSync(macroPath, "MacroFolderSymbol equ 1\n");

  try {
    const workspace = indexWorkspace(entryPath, new Map(), undefined, { macroFolder });
    assert.deepEqual(workspace.loadOrder, [entryPath, macroPath]);
    assert.deepEqual(workspace.dependencies.get(entryPath), [macroPath]);
    assert.equal(workspace.symbols.has("MacroFolderSymbol"), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function runIncludeTargetTest(): void {
  const document = parseDocument(
    ["  asm \"main.S\"", "  put dir/child.S", "  use 4/Int.Macs", "  asm pre+post"].join("\n")
  );

  const stringTarget = readIncludeTarget(document.lines[0].node.shape === "directive" ? document.lines[0].node.operand : null);
  assert.deepEqual(stringTarget, { path: "main.S", range: { startCharacter: 6, endCharacter: 14 } });

  const identifierTarget = readIncludeTarget(document.lines[1].node.shape === "directive" ? document.lines[1].node.operand : null);
  assert.deepEqual(identifierTarget, { path: "dir/child.S", range: { startCharacter: 6, endCharacter: 17 } });

  const numericTarget = readIncludeTarget(document.lines[2].node.shape === "directive" ? document.lines[2].node.operand : null);
  assert.deepEqual(numericTarget, { path: "4/Int.Macs", range: null });

  const binaryTarget = readIncludeTarget(document.lines[3].node.shape === "directive" ? document.lines[3].node.operand : null);
  assert.deepEqual(binaryTarget, { path: "pre+post", range: { startCharacter: 6, endCharacter: 14 } });

  assert.equal(readIncludeTarget(null), null);
}
