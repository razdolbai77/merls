import assert from "node:assert/strict";
import path from "node:path";
import { startJsonRpcClient } from "./helpers/json-rpc-client";

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
  } finally {
    client.stop();
  }
}
