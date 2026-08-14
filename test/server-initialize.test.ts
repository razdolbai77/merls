import assert from "node:assert/strict";
import path from "node:path";
import { startJsonRpcClient } from "./helpers/json-rpc-client";
import { isKnownInitializationOptionKey, readMacroFolder } from "../src/server";

type InitializeResult = {
  capabilities?: {
    definitionProvider?: boolean;
    referencesProvider?: boolean;
    completionProvider?: {
      triggerCharacters?: readonly string[];
    };
    textDocumentSync?: {
      change?: number;
      openClose?: boolean;
    };
  };
};

export async function runInitializeHandshakeTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const client = startJsonRpcClient(process.execPath, [serverPath]);

  try {
    const message = await client.request("initialize", {
      capabilities: {},
      clientInfo: {
        name: "merls-test"
      },
      processId: process.pid,
      rootUri: null
    });
    const result = message.result as InitializeResult | undefined;

    assert.equal(message.id, 1);
    assert.equal(message.jsonrpc, "2.0");
    assert.equal(typeof result?.capabilities, "object");
    assert.equal(result?.capabilities?.textDocumentSync?.openClose, true);
    assert.equal(result?.capabilities?.textDocumentSync?.change, 1);
    assert.equal(result?.capabilities?.definitionProvider, true);
    assert.equal(result?.capabilities?.referencesProvider, true);
    const completionTriggers = result?.capabilities?.completionProvider?.triggerCharacters;
    assert.equal(completionTriggers?.includes("]"), true);
    assert.equal(completionTriggers?.includes(":"), true);
    assert.equal(completionTriggers?.includes("b"), true);
    assert.equal(completionTriggers?.includes("G"), true);
    assert.equal(completionTriggers?.includes("_"), true);

    // Verify type guard and unknown option warning logic
    assert.equal(isKnownInitializationOptionKey("merlinMacroFolder"), true);
    assert.equal(isKnownInitializationOptionKey("macroFolder"), true);
    assert.equal(isKnownInitializationOptionKey("unknownOption"), false);

    const warnings: string[] = [];
    const folder = readMacroFolder(
      { merlinMacroFolder: "/path/to/macros", unknownOpt: "value" },
      (msg: string) => warnings.push(msg)
    );
    assert.equal(folder, "/path/to/macros");
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /unknownOpt/i);
  } finally {
    client.stop();
  }
}
