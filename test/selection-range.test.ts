import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
