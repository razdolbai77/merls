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

export async function runDiskCacheMergeTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "merls-disk-cache-"));
  const bufferPath = path.join(tempDir, "buffer.S");
  const otherPath = path.join(tempDir, "other.S");
  const casePath = path.join(tempDir, "case.S");

  fs.writeFileSync(bufferPath, "DiskSym  equ $1\n");
  fs.writeFileSync(otherPath, "OtherSym equ $5\n");
  fs.writeFileSync(casePath, "CaseSym  equ $3\n");

  const bufferUri = pathToFileURL(bufferPath).href;
  const otherUri = pathToFileURL(otherPath).href;
  const caseUri = pathToFileURL(casePath).href;

  const client = startJsonRpcClient(process.execPath, [serverPath], { requestTimeoutMs: 5_000 });
  const { notify: sendNotification, request: sendRequest, stop } = client;
  try {
    await sendRequest("initialize", {
      capabilities: {},
      processId: process.pid,
      rootUri: pathToFileURL(tempDir).href
    });
    sendNotification("initialized", {});

    // Open buffer.S with unsaved content, then let the watched-file handler
    // load the stale disk content into diskCache.
    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: bufferUri,
        languageId: "asm",
        version: 1,
        text: "BufferSym equ $2\n"
      }
    });

    sendNotification("workspace/didChangeWatchedFiles", {
      changes: [
        { uri: bufferUri, type: 1 },
        { uri: otherUri, type: 1 }
      ]
    });

    // Poll for the unopened file to prove the watched-file handler finished.
    const deadline = Date.now() + 3_000;
    let otherIndexed = false;
    do {
      const response = await sendRequest("workspace/symbol", { query: "OtherSym" });
      const symbols = response.result as WorkspaceSymbolResult;
      otherIndexed = symbols.some((symbol) => symbol.name === "OtherSym");
      if (!otherIndexed && Date.now() < deadline) {
        await delay(20);
      }
    } while (!otherIndexed && Date.now() < deadline);
    assert.equal(otherIndexed, true, "expected OtherSym to be indexed from disk");

    const bufferResponse = await sendRequest("workspace/symbol", { query: "BufferSym" });
    const bufferSymbols = bufferResponse.result as WorkspaceSymbolResult;
    assert.equal(
      bufferSymbols.some((symbol) => symbol.name === "BufferSym"),
      true,
      "expected the unsaved buffer content to stay indexed"
    );

    const staleResponse = await sendRequest("workspace/symbol", { query: "DiskSym" });
    const staleSymbols = staleResponse.result as WorkspaceSymbolResult;
    assert.equal(
      staleSymbols.some((symbol) => symbol.name === "DiskSym"),
      false,
      "stale disk content must not overwrite an open buffer in the index"
    );

    // Case-mismatched open URI must not create a duplicate index entry.
    const lowerCaseUri = caseUri.replace(
      /^file:\/\/\/([A-Za-z]):/,
      (_match, driveLetter: string) => `file:///${driveLetter.toLowerCase()}:`
    );

    sendNotification("workspace/didChangeWatchedFiles", {
      changes: [{ uri: caseUri, type: 1 }]
    });

    const caseDeadline = Date.now() + 3_000;
    let caseIndexed = false;
    do {
      const response = await sendRequest("workspace/symbol", { query: "CaseSym" });
      const symbols = response.result as WorkspaceSymbolResult;
      caseIndexed = symbols.some((symbol) => symbol.name === "CaseSym");
      if (!caseIndexed && Date.now() < caseDeadline) {
        await delay(20);
      }
    } while (!caseIndexed && Date.now() < caseDeadline);
    assert.equal(caseIndexed, true, "expected CaseSym to be indexed from disk");

    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: lowerCaseUri,
        languageId: "asm",
        version: 1,
        text: "CaseSym  equ $3\n"
      }
    });

    const caseResponse = await sendRequest("workspace/symbol", { query: "CaseSym" });
    const caseSymbols = caseResponse.result as WorkspaceSymbolResult;
    if (lowerCaseUri !== caseUri) {
      assert.equal(
        caseSymbols.length,
        1,
        "case-mismatched open URI must not duplicate the indexed document"
      );
    }
    assert.equal(caseSymbols[0]?.name, "CaseSym");
  } finally {
    stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
