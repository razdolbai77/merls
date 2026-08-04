import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { startJsonRpcClient } from "./helpers/json-rpc-client";

type WorkspaceSymbolResult = Array<{
  name: string;
  location: { uri: string };
}>;

async function pollForSymbol(
  sendRequest: (method: string, params: object) => Promise<{ result?: unknown }>,
  name: string,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await sendRequest("workspace/symbol", { query: name });
    const symbols = response.result as WorkspaceSymbolResult;
    if (Array.isArray(symbols) && symbols.some((symbol) => symbol.name === name)) {
      return true;
    }
    if (Date.now() >= deadline) {
      return false;
    }
    await delay(20);
  }
}

export async function runDiskCacheEvictionTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "merls-disk-cache-eviction-"));
  const entryPath = path.join(tempDir, "entry.S");
  const includedPath = path.join(tempDir, "included.S");
  const strayPath = path.join(tempDir, "stray.S");

  fs.writeFileSync(entryPath, "  asm \"included.S\"\nEntrySym equ $1\n");
  fs.writeFileSync(includedPath, "IncludedSym equ $2\n");
  fs.writeFileSync(strayPath, "StraySym equ $3\n");

  const entryUri = pathToFileURL(entryPath).href;
  const includedUri = pathToFileURL(includedPath).href;
  const strayUri = pathToFileURL(strayPath).href;

  const client = startJsonRpcClient(process.execPath, [serverPath], { requestTimeoutMs: 5_000 });
  const { notify: sendNotification, request: sendRequest, stop } = client;
  try {
    await sendRequest("initialize", {
      capabilities: {},
      processId: process.pid,
      rootUri: pathToFileURL(tempDir).href
    });
    sendNotification("initialized", {});

    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: entryUri,
        languageId: "asm",
        version: 1,
        text: fs.readFileSync(entryPath, "utf8")
      }
    });

    sendNotification("workspace/didChangeWatchedFiles", {
      changes: [
        { uri: includedUri, type: 1 },
        { uri: strayUri, type: 1 }
      ]
    });

    assert.equal(
      await pollForSymbol(sendRequest, "IncludedSym", 3_000),
      true,
      "expected include-reachable disk content to stay indexed"
    );

    const strayResponse = await sendRequest("workspace/symbol", { query: "StraySym" });
    const straySymbols = strayResponse.result as WorkspaceSymbolResult;
    assert.equal(
      straySymbols.some((symbol) => symbol.name === "StraySym"),
      false,
      "expected unreachable disk cache entries to be evicted"
    );

    // Closing the only open document drops every cached path.
    sendNotification("textDocument/didClose", {
      textDocument: { uri: entryUri }
    });
    await delay(50);

    const includedAfterClose = await sendRequest("workspace/symbol", { query: "IncludedSym" });
    const includedSymbols = includedAfterClose.result as WorkspaceSymbolResult;
    assert.equal(
      includedSymbols.some((symbol) => symbol.name === "IncludedSym"),
      false,
      "expected the disk cache to be empty once no open document can reach it"
    );
  } finally {
    stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
