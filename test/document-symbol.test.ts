import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startJsonRpcClient } from "./helpers/json-rpc-client";







export async function runDocumentSymbolTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const fixturePath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-main-6502.S"
  );
  const uri = `file://${fixturePath.replace(/\\/g, "/")}`;
  const text = fs.readFileSync(fixturePath, "utf8");
  const client = startJsonRpcClient(process.execPath, [serverPath]);
  const { notify: sendNotification, request: sendRequest, stop } = client;
  try {
    const initialize = await sendRequest("initialize", {
      capabilities: {},
      processId: process.pid,
      rootUri: null
    });
    assert.equal(initialize.id, 1);

    const testText = text + "\n  ]INDENTED ds 1\n";

    sendNotification("initialized", {});
    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: "asm",
        version: 1,
        text: testText
      }
    });

    const response = await sendRequest("textDocument/documentSymbol", {
      textDocument: { uri }
    });

    const symbols = response.result as Array<{
      name: string;
      kind: number;
      location: {
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
      };
    }>;
    assert.equal(Array.isArray(symbols), true);
    assert.equal(symbols.some((symbol) => symbol.name === "TEXT" && symbol.kind === 13), true);
    assert.equal(symbols.some((symbol) => symbol.name === "TEST_START" && symbol.kind === 6), true);
    assert.equal(symbols.some((symbol) => symbol.name === "dum0" && symbol.kind === 8), true);

    const indentedSymbol = symbols.find((symbol) => symbol.name === "]INDENTED");
    assert.equal(indentedSymbol !== undefined, true);
    assert.equal(indentedSymbol?.location.range.start.character, 2);
    assert.equal(indentedSymbol?.location.range.end.character, 11);
  } finally {
    stop();
  }
}
