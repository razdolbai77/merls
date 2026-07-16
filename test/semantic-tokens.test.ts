import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startJsonRpcClient } from "./helpers/json-rpc-client";







export async function runSemanticTokensTest(): Promise<void> {
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

    const semanticTokensResponse = await sendRequest("textDocument/semanticTokens/full", {
      textDocument: { uri: mainUri }
    });

    const result = semanticTokensResponse.result as { data: number[] };
    assert.ok(Array.isArray(result.data), "Expected data to be an array");
    assert.ok(result.data.length > 0, "Expected non-empty semantic tokens array");

    // Test macro-heavy fixture
    const macroPath = path.resolve(
      process.cwd(),
      "test/fixtures/valid/merlin32-macro-coverage.S"
    );
    const macroUri = `file://${macroPath.replace(/\\/g, "/")}`;
    const macroText = fs.readFileSync(macroPath, "utf8");

    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: macroUri,
        languageId: "asm",
        version: 1,
        text: macroText
      }
    });

    const macroTokensResponse = await sendRequest("textDocument/semanticTokens/full", {
      textDocument: { uri: macroUri }
    });
    
    const macroResult = macroTokensResponse.result as { data: number[] };
    assert.ok(Array.isArray(macroResult.data), "Expected macro data to be an array");
    assert.ok(macroResult.data.length > 0, "Expected non-empty semantic tokens for macro file");

  } finally {
    stop();
  }
}
