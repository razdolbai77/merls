import assert from "node:assert/strict";
import path from "node:path";
import { createPromiseResolvers, startJsonRpcClient } from "./helpers/json-rpc-client";



type PublishedDiagnostic = {
  message: string;
  severity?: number;
  range: {
    start: {
      line: number;
      character: number;
    };
    end: {
      line: number;
      character: number;
    };
  };
};

type PublishDiagnosticsParams = {
  uri: string;
  diagnostics: PublishedDiagnostic[];
};





export async function runPublishDiagnosticsTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const documentPath = path.resolve(
    process.cwd(),
    "test/fixtures/invalid/publish-diagnostics.S"
  );
  const documentUri = `file://${documentPath.replace(/\\/g, "/")}`;
  const brokenText = ["dup     equ 1", "        lda missing", "dup     equ 2", "        adc ("].join(
    "\n"
  );
  const fixedText = ["dup     equ 1", "        lda dup", "        adc #1"].join("\n");
  const client = startJsonRpcClient(process.execPath, [serverPath]);
  const { notify: sendNotification, request: sendRequest, stop } = client;
  const diagnosticWaiters: Array<(params: PublishDiagnosticsParams) => void> = [];
  const removeNotificationListener = client.onNotification((message) => {
    if (message.method === "textDocument/publishDiagnostics") {
      const params = message.params as PublishDiagnosticsParams;
      diagnosticWaiters.shift()?.(params);
    }
  });
  function waitForDiagnostics(): Promise<PublishDiagnosticsParams> {
    const { promise, resolve } = createPromiseResolvers<PublishDiagnosticsParams>();
    diagnosticWaiters.push(resolve);
    return promise;
  }

  try {
    await sendRequest("initialize", {
      capabilities: {},
      processId: process.pid,
      rootUri: `file://${path.resolve(process.cwd()).replace(/\\/g, "/")}`
    });

    sendNotification("initialized", {});

    const openedDiagnostics = waitForDiagnostics();
    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: documentUri,
        languageId: "asm",
        version: 1,
        text: brokenText
      }
    });

    const firstPublish = await openedDiagnostics;
    assert.equal(firstPublish.uri, documentUri);
    assert.equal(
      firstPublish.diagnostics.some(
        (diagnostic) =>
          diagnostic.message.includes("Unresolved reference missing") &&
          diagnostic.severity === 1 &&
          diagnostic.range.start.line === 1
      ),
      true
    );
    assert.equal(
      firstPublish.diagnostics.some(
        (diagnostic) =>
          diagnostic.message.includes("Duplicate symbol dup") &&
          diagnostic.severity === 1 &&
          diagnostic.range.start.line === 2
      ),
      true
    );
    assert.equal(
      firstPublish.diagnostics.some(
        (diagnostic) =>
          diagnostic.message.includes("expected expression token") &&
          diagnostic.severity === 1 &&
          diagnostic.range.start.line === 3
      ),
      true
    );

    const changedDiagnostics = waitForDiagnostics();
    sendNotification("textDocument/didChange", {
      textDocument: {
        uri: documentUri,
        version: 2
      },
      contentChanges: [
        {
          text: fixedText
        }
      ]
    });

    const secondPublish = await changedDiagnostics;
    assert.equal(secondPublish.uri, documentUri);
    assert.deepEqual(secondPublish.diagnostics, []);

    // Multi-entry workspace test
    const secondUri = `file://${path.resolve(process.cwd(), "test/fixtures/invalid/publish-diagnostics-2.S").replace(/\\/g, "/")}`;
    const firstUpdateWait = waitForDiagnostics();
    const secondUpdateWait = waitForDiagnostics();

    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: secondUri,
        languageId: "asm",
        version: 1,
        text: "otherLabel equ 1"
      }
    });

    // We expect TWO publish diagnostics events
    const p1 = await firstUpdateWait;
    const p2 = await secondUpdateWait;

    const uris = [p1.uri, p2.uri].sort();
    const expectedUris = [documentUri, secondUri].sort();
    assert.deepEqual(uris, expectedUris, "Expected diagnostics published for both open documents");

    const closeUpdateWait1 = waitForDiagnostics();
    const closeUpdateWait2 = waitForDiagnostics();

    sendNotification("textDocument/didClose", {
      textDocument: {
        uri: secondUri
      }
    });

    const c1 = await closeUpdateWait1;
    const c2 = await closeUpdateWait2;
    
    const closeUris = [c1.uri, c2.uri].sort();
    assert.deepEqual(closeUris, expectedUris, "Expected clearing diagnostics and remaining document update");
  } finally {
    removeNotificationListener();
    stop();
  }
}
