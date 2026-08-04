import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startJsonRpcClient } from "./helpers/json-rpc-client";







function positionOf(text: string, needle: string): { line: number; character: number } {
  const index = text.indexOf(needle);
  assert.notEqual(index, -1, `expected to find ${needle}`);
  const prefix = text.slice(0, index);
  const lines = prefix.split("\n");
  return {
    line: lines.length - 1,
    character: lines.at(-1)?.length ?? 0
  };
}

export async function runDefinitionReferencesTest(): Promise<void> {
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

    const bplPos = positionOf(text, "bpl GetKey");
    const definitionResponse = await sendRequest("textDocument/definition", {
      textDocument: { uri: mainUri },
      position: { line: bplPos.line, character: bplPos.character + 4 }
    });

    const definition = definitionResponse.result as { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } };
    assert.equal(definition.uri, mainUri);
    assert.equal(definition.range.start.line, 70);
    assert.equal(definition.range.start.character, 0); // "GetKey" label
    assert.equal(definition.range.end.character, 6);

    const getKPos = positionOf(text, "GetKey  ldx");
    const referencesResponse = await sendRequest("textDocument/references", {
      textDocument: { uri: mainUri },
      position: { line: getKPos.line, character: getKPos.character },
      context: {
        includeDeclaration: true
      }
    });

    const references = referencesResponse.result as Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }>;
    assert.equal(Array.isArray(references), true);
    
    const defRef = references.find((reference) => reference.uri === mainUri && reference.range.start.line === 70);
    assert.equal(defRef !== undefined, true);
    assert.equal(defRef?.range.start.character, 0); // "GetKey" label
    assert.equal(defRef?.range.end.character, 6);

    const usageRef = references.find((reference) => reference.uri === mainUri && reference.range.start.line === 71);
    assert.equal(usageRef !== undefined, true);
    const expectedUsageChar = text.split("\n")[71].indexOf("GetKey");
    assert.equal(usageRef?.range.start.character, expectedUsageChar);
    assert.equal(usageRef?.range.end.character, expectedUsageChar + 6);
  } finally {
    stop();
  }
}
