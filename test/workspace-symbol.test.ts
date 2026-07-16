import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startJsonRpcClient } from "./helpers/json-rpc-client";







export async function runWorkspaceSymbolTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const linkPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-linkscript.S"
  );
  const mainPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-main-6502.S"
  );
  const linkUri = `file://${linkPath.replace(/\\/g, "/")}`;
  const mainUri = `file://${mainPath.replace(/\\/g, "/")}`;
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
        uri: linkUri,
        languageId: "asm",
        version: 1,
        text: fs.readFileSync(linkPath, "utf8")
      }
    });
    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: mainUri,
        languageId: "asm",
        version: 1,
        text: fs.readFileSync(mainPath, "utf8")
      }
    });

    const response = await sendRequest("workspace/symbol", {
      query: "Get"
    });

    const symbols = response.result as Array<{ name: string; location: { uri: string } }>;
    assert.equal(Array.isArray(symbols), true);
    assert.equal(symbols.some((symbol) => symbol.name === "GetKey" && symbol.location.uri === mainUri), true);
  } finally {
    stop();
  }
}
