import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildCachedDocument, CachedDocument } from "../src/asm/document";
import { buildSelectionRanges } from "../src/lsp/selection-range";
import { startJsonRpcClient } from "./helpers/json-rpc-client";



type SelectionRangeResponse = {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  parent?: SelectionRangeResponse;
};





export async function runSelectionRangeTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const mainPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-main-6502.S"
  );
  const mainUri = `file://${mainPath.replace(/\\/g, "/")}`;
  const text = fs.readFileSync(mainPath, "utf8");
  const client = startJsonRpcClient(process.execPath, [serverPath]);
  const { notify: sendNotification, request: sendRequest, stop } = client;
  try {
    await sendRequest("initialize", {
      capabilities: {},
      processId: process.pid,
      rootUri: `file://${path.resolve(process.cwd()).replace(/\\/g, "/")}`
    });

    sendNotification("initialized", {});
    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: mainUri,
        languageId: "asm",
        version: 1,
        text
      }
    });

    const response = await sendRequest("textDocument/selectionRange", {
      textDocument: { uri: mainUri },
      positions: [{ line: 70, character: 4 }] // "GetKey" or something nearby
    });

    const ranges = response.result as Array<SelectionRangeResponse>;

    assert.equal(Array.isArray(ranges), true);
    assert.equal(ranges.length, 1);
    
    // Check nested structure
    const range0 = ranges[0]; // token
    assert.ok(range0.parent !== undefined, "Expected parent range");
    
    const range1 = range0.parent; // line
    assert.ok(range1.parent !== undefined, "Expected parent range for line");

    const range2 = range1.parent; // scope
    assert.ok(range2.parent !== undefined, "Expected parent range for scope");

    const range3 = range2.parent; // file
    assert.equal(range3.parent, undefined, "File range should have no parent");

  } finally {
    stop();
  }
}

export function runSelectionRangeBoundsTest(): void {
  const uri = "file:///workspace/main.S";
  const source = "start\n  lda #0\n  rts";
  const openDocuments = new Map<string, CachedDocument>([
    [uri, buildCachedDocument(source)]
  ]);

  // Positions at or past the last line must not throw; they fall back to the file range.
  const results = buildSelectionRanges(openDocuments, uri, [
    { line: 3, character: 0 },
    { line: 99, character: 5 },
    { line: -1, character: 0 }
  ]);

  assert.ok(results !== null);
  assert.equal(results.length, 3);

  const fileRange = {
    start: { line: 0, character: 0 },
    end: { line: 2, character: 5 }
  };

  for (const result of results) {
    assert.deepEqual(result.range, fileRange);
    assert.equal(result.parent, undefined);
  }

  // In-bounds positions still produce the nested token/line/scope/file chain.
  const valid = buildSelectionRanges(openDocuments, uri, [{ line: 1, character: 3 }]);
  assert.ok(valid !== null);
  assert.equal(valid.length, 1);
  assert.ok(valid[0].parent !== undefined, "Expected nested ranges for in-bounds position");
}
