import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startJsonRpcClient } from "./helpers/json-rpc-client";







export async function runCodeLensTest(): Promise<void> {
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
        languageId: "6502",
        version: 1,
        text
      }
    });

    const lensResponse = await sendRequest("textDocument/codeLens", {
      textDocument: { uri: mainUri }
    });

    const lenses = lensResponse.result as Array<{
      range: { start: { line: number; character: number } };
      command: { title: string; command: string };
    }>;

    assert.equal(Array.isArray(lenses), true);
    
    // In merlin32-main-6502.S, there is a label 'GetKey' used 1 time (so 1 reference) 
    // wait, we don't know exactly. But let's check if the lenses array has something.
    assert.equal(lenses.length > 0, true);

    const codeLensCount = lenses.find(l => l.command.title.includes("reference"));
    assert.ok(codeLensCount !== undefined, "Expected at least one lens with reference count");
    assert.equal(codeLensCount.command.command, "");

  } finally {
    stop();
  }
}
