import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { startJsonRpcClient } from "./helpers/json-rpc-client";







export async function runWatchedFilesTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const workspacePath = path.resolve(process.cwd(), "test/fixtures/valid");
  
  // We'll simulate a file changing on disk
  const testFilePath = path.resolve(workspacePath, "watched-test.S");
  const testFileUri = `file://${testFilePath.replace(/\\/g, "/")}`;

  fs.writeFileSync(testFilePath, "NewSymbol  equ $1234\n");

  const client = startJsonRpcClient(process.execPath, [serverPath], { requestTimeoutMs: 1_000 });
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

    const deadline = Date.now() + 1_000;
    let symbolIndexed = false;
    do {
      const symbolsResponse = await sendRequest("workspace/symbol", {
        query: "NewSymbol"
      });
      const symbols = symbolsResponse.result as Array<{ name: string }>;
      assert.equal(Array.isArray(symbols), true);
      symbolIndexed = symbols.some((symbol) => symbol.name === "NewSymbol");

      if (!symbolIndexed && Date.now() < deadline) {
        await delay(20);
      }
    } while (!symbolIndexed && Date.now() < deadline);

    assert.equal(symbolIndexed, true, "Expected NewSymbol to be indexed within one second");

  } finally {
    stop();
    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}
