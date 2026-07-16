import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startJsonRpcClient } from "./helpers/json-rpc-client";







export async function runWatchedFilesTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const workspacePath = path.resolve(process.cwd(), "test/fixtures/valid");
  
  // We'll simulate a file changing on disk
  const testFilePath = path.resolve(workspacePath, "watched-test.S");
  const testFileUri = `file://${testFilePath.replace(/\\/g, "/")}`;

  fs.writeFileSync(testFilePath, "NewSymbol  equ $1234\n");

  const client = startJsonRpcClient(process.execPath, [serverPath]);
  const { notify: sendNotification, request: sendRequest, stop } = client;
  try {
    await sendRequest("initialize", {
      capabilities: {},
      processId: process.pid,
      rootUri: `file://${workspacePath.replace(/\\/g, "/")}`
    });

    sendNotification("initialized", {});

    // Notify that a file was created/changed
    sendNotification("workspace/didChangeWatchedFiles", {
      changes: [
        {
          uri: testFileUri,
          type: 1 // Created
        }
      ]
    });

    // Wait a bit for processing
    await new Promise(r => setTimeout(r, 100));

    // Request workspace symbols and see if NewSymbol is found
    const symbolsResponse = await sendRequest("workspace/symbol", {
      query: "NewSymbol"
    });

    const symbols = symbolsResponse.result as Array<{ name: string }>;
    assert.equal(Array.isArray(symbols), true);
    assert.equal(symbols.some(s => s.name === "NewSymbol"), true);

  } finally {
    stop();
    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}
