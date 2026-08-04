import assert from "node:assert/strict";
import { buildCachedDocument, CachedDocument } from "../src/asm/document";
import { buildRenameEdits } from "../src/lsp/rename";
import { ResponseError } from "vscode-languageserver/node";

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

  // Merlin variables keep their ] prefix when renamed.
  {
    const variableUri = "file:///workspace/variable.S";
    const variableSource = `
]count = 1
  lda ]count
`;
    const variableDocuments = new Map<string, CachedDocument>([
      [variableUri, buildCachedDocument(variableSource)]
    ]);

    const edits = buildRenameEdits(variableDocuments, variableUri, 1, 0, "newCount");
    assert.ok(edits !== null);
    assert.ok(edits.changes);
    for (const edit of edits.changes[variableUri]) {
      assert.equal(edit.newText, "]newCount");
    }

    const editsWithPrefix = buildRenameEdits(variableDocuments, variableUri, 1, 0, "]tally");
    assert.ok(editsWithPrefix !== null);
    assert.ok(editsWithPrefix.changes);
    for (const edit of editsWithPrefix.changes[variableUri]) {
      assert.equal(edit.newText, "]tally");
    }
  }

  // Macro parameter placeholders cannot be renamed.
  {
    const paramUri = "file:///workspace/param.S";
    const paramSource = `
Wrap mac
  lda ]1
  eom
`;
    const paramDocuments = new Map<string, CachedDocument>([
      [paramUri, buildCachedDocument(paramSource)]
    ]);

    assert.throws(
      () => buildRenameEdits(paramDocuments, paramUri, 2, 6, "Anything"),
      ResponseError
    );
  }

  // Local labels cannot be renamed, at definition or reference.
  {
    const localUri = "file:///workspace/local.S";
    const localSource = `
start
:loop
]skip
  jmp :loop
  beq ]skip
`;
    const localDocuments = new Map<string, CachedDocument>([
      [localUri, buildCachedDocument(localSource)]
    ]);

    assert.throws(
      () => buildRenameEdits(localDocuments, localUri, 2, 0, "renamed"),
      ResponseError
    );
    assert.throws(
      () => buildRenameEdits(localDocuments, localUri, 3, 0, "renamed"),
      ResponseError
    );
    assert.throws(
      () => buildRenameEdits(localDocuments, localUri, 4, 6, "renamed"),
      ResponseError
    );
    assert.throws(
      () => buildRenameEdits(localDocuments, localUri, 5, 6, "renamed"),
      ResponseError
    );
  }

  // newName must be a valid Merlin identifier.
  {
    assert.throws(
      () => buildRenameEdits(openDocuments, file2Uri, 1, 0, "1bad"),
      ResponseError
    );
    assert.throws(
      () => buildRenameEdits(openDocuments, file2Uri, 1, 0, "has space"),
      ResponseError
    );
    assert.throws(
      () => buildRenameEdits(openDocuments, file2Uri, 1, 0, "]local"),
      ResponseError
    );
    assert.throws(
      () => buildRenameEdits(openDocuments, file2Uri, 1, 0, ""),
      ResponseError
    );
  }
}
