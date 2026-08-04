import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
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
        languageId: "6502",
        version: 1,
        text: fs.readFileSync(linkPath, "utf8")
      }
    });
    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: mainUri,
        languageId: "6502",
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


export async function runMacroFolderWorkspaceSymbolTest(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "merls-server-macro-folder-"));
  const macroFolder = path.join(tempDir, "MerlinMacros");
  const sourcePath = path.join(tempDir, "main.S");
  const macroPath = path.join(macroFolder, "Int.Macs.s");
  const source = "        use 4/Int.Macs\n";
  fs.mkdirSync(macroFolder);
  fs.writeFileSync(sourcePath, source);
  fs.writeFileSync(macroPath, "MacroFolderSymbol equ 1\n");

  const serverPath = path.resolve(__dirname, "../src/server.js");
  const sourceUri = `file://${sourcePath.replace(/\\/g, "/")}`;
  const client = startJsonRpcClient(process.execPath, [serverPath]);
  const { notify: sendNotification, request: sendRequest, stop } = client;
  try {
    await sendRequest("initialize", {
      capabilities: {},
      initializationOptions: { merlinMacroFolder: macroFolder },
      processId: process.pid,
      rootUri: `file://${tempDir.replace(/\\/g, "/")}`
    });
    sendNotification("initialized", {});
    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: sourceUri,
        languageId: "6502",
        version: 1,
        text: source
      }
    });

    const response = await sendRequest("workspace/symbol", {
      query: "MacroFolderSymbol"
    });
    const symbols = response.result as Array<{ name: string }>;
    assert.equal(symbols.some((symbol) => symbol.name === "MacroFolderSymbol"), true);
  } finally {
    stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}