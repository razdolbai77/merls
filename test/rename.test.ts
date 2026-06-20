import assert from "node:assert/strict";
import { buildCachedDocument, CachedDocument } from "../src/asm/document";
import { buildRenameEdits } from "../src/lsp/rename";

export function runRenameTest(): void {
  const file1Uri = "file:///workspace/main.S";
  const file2Uri = "file:///workspace/lib.S";

  const file1Source = `
start
  jsr utils
  lda #0
  rts
  `;
  const file2Source = `
utils
  inx
  rts
  `;

  const openDocuments = new Map<string, CachedDocument>([
    [file1Uri, buildCachedDocument(file1Source)],
    [file2Uri, buildCachedDocument(file2Source)]
  ]);

  // Rename "utils" from its definition in file2
  {
    // "utils" is at line 1, character 0 in lib.S
    const edits = buildRenameEdits(openDocuments, file2Uri, 1, 0, "newUtils");
    assert.ok(edits !== null);
    assert.ok(edits.changes);
    assert.equal(edits.changes[file1Uri].length, 1);
    assert.equal(edits.changes[file1Uri][0].newText, "newUtils");
    assert.equal(edits.changes[file2Uri].length, 1);
    assert.equal(edits.changes[file2Uri][0].newText, "newUtils");
  }

  // Rename "start" from its definition in file1
  {
    const edits = buildRenameEdits(openDocuments, file1Uri, 1, 0, "mainStart");
    assert.ok(edits !== null);
    assert.ok(edits.changes);
    assert.equal(edits.changes[file1Uri].length, 1);
    assert.equal(edits.changes[file1Uri][0].newText, "mainStart");
    assert.equal(edits.changes[file2Uri], undefined);
  }

  // Unknown symbol
  {
    buildRenameEdits(openDocuments, file1Uri, 2, 4, "nothing");
    // "lda #0" does not contain a symbol at character 4 (it's "#")
    // Wait, let's pick line 3 "rts" at character 1
    const editsEmpty = buildRenameEdits(openDocuments, file1Uri, 3, 1, "nothing");
    assert.equal(editsEmpty, null);
  }
}
