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

  // Rename a symbol passed into a macro call should update the definition and the call-site argument token.
  {
    const macroUri = "file:///workspace/macro.S";
    const macroSource = `
Wrap mac
  lda ]1
  sta ]1
  eom
Target
  Wrap Target
  `;
    const macroDocuments = new Map<string, CachedDocument>([
      [macroUri, buildCachedDocument(macroSource)]
    ]);

    const edits = buildRenameEdits(macroDocuments, macroUri, 5, 0, "RenamedTarget");
    assert.ok(edits !== null);
    assert.ok(edits.changes);
    assert.equal(edits.changes[macroUri].length, 2);
    assert.equal(edits.changes[macroUri][0].newText, "RenamedTarget");
    assert.equal(edits.changes[macroUri][1].newText, "RenamedTarget");
    assert.deepEqual(
      edits.changes[macroUri].map((edit) => edit.range.start),
      [
        { line: 5, character: 0 },
        { line: 6, character: 7 }
      ]
    );
  }

  // Nested macro call references should still rename the concrete call-site symbol only.
  {
    const nestedMacroUri = "file:///workspace/nested-macro.S";
    const nestedMacroSource = `
Inner mac
  lda ]1
  eom
Outer mac
  Inner ]1
  sta ]1
  eom
Target
  Outer Target
  `;
    const nestedDocuments = new Map<string, CachedDocument>([
      [nestedMacroUri, buildCachedDocument(nestedMacroSource)]
    ]);

    const edits = buildRenameEdits(nestedDocuments, nestedMacroUri, 8, 0, "NestedTarget");
    assert.ok(edits !== null);
    assert.ok(edits.changes);
    assert.equal(edits.changes[nestedMacroUri].length, 2);
    assert.deepEqual(
      edits.changes[nestedMacroUri].map((edit) => edit.range.start),
      [
        { line: 8, character: 0 },
        { line: 9, character: 8 }
      ]
    );
  }
}
