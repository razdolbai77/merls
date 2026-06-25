import assert from "node:assert/strict";
import path from "node:path";

import { buildCachedDocument } from "../src/asm/document";
import { collectDocumentMacros, collectWorkspaceMacros } from "../src/asm/macros";
import { indexWorkspace } from "../src/asm/workspace";

export function runMacroIndexTest(): void {
  const entryPath = path.resolve(process.cwd(), "test/fixtures/valid/macro-index-entry.S");
  const helperPath = path.resolve(process.cwd(), "test/fixtures/valid/macro-index-helper.S");

  const entryDocument = buildCachedDocument([
    "MainMac mac",
    "        ]loop lda ]1",
    "        HelperMac ]2",
    "        sta Target",
    "        bne ]loop",
    "        eom",
    "        put macro-index-helper.S"
  ].join("\n"));
  const helperDocument = buildCachedDocument([
    "HelperMac mac",
    "        lda ]1",
    "        eom"
  ].join("\n"));

  const documentMacros = collectDocumentMacros(entryDocument.parsed);
  assert.equal(documentMacros.size, 1);
  assert.deepEqual(documentMacros.get("MainMac"), {
    name: "MainMac",
    line: 0,
    startLine: 0,
    endLine: 5,
    bodyStartLine: 1,
    bodyEndLine: 4,
    maxParameterIndex: 2,
    referencedSymbols: ["Target"],
    nestedCalls: ["HelperMac"],
    localLabelDefinitions: ["]loop"],
    localLabelReferences: ["]loop"]
  });

  // Verify caching
  const documentMacros2 = collectDocumentMacros(entryDocument.parsed);
  assert.equal(documentMacros, documentMacros2, "documentMacros should be cached per ParsedDocument");

  const workspaceMacros = collectWorkspaceMacros(new Map([
    [entryPath, entryDocument],
    [helperPath, helperDocument]
  ]));

  assert.deepEqual(workspaceMacros.get("MainMac"), [
    {
      name: "MainMac",
      line: 0,
      startLine: 0,
      endLine: 5,
      bodyStartLine: 1,
      bodyEndLine: 4,
      maxParameterIndex: 2,
      referencedSymbols: ["Target"],
      nestedCalls: ["HelperMac"],
      localLabelDefinitions: ["]loop"],
      localLabelReferences: ["]loop"],
      filePath: entryPath
    }
  ]);

  assert.deepEqual(workspaceMacros.get("HelperMac"), [
    {
      name: "HelperMac",
      line: 0,
      startLine: 0,
      endLine: 2,
      bodyStartLine: 1,
      bodyEndLine: 1,
      maxParameterIndex: 1,
      referencedSymbols: [],
      nestedCalls: [],
      localLabelDefinitions: [],
      localLabelReferences: [],
      filePath: helperPath
    }
  ]);

  const workspace = indexWorkspace(entryPath, new Map([
    [entryPath, entryDocument],
    [helperPath, helperDocument]
  ]));
  assert.deepEqual(workspace.macros, workspaceMacros);
}
