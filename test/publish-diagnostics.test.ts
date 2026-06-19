import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";

type JsonRpcMessage = {
  id?: number;
  jsonrpc: "2.0";
  method?: string;
  params?: unknown;
  result?: unknown;
};

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

function encodeMessage(message: object): string {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function decodeMessages(streamBuffer: string): { messages: JsonRpcMessage[]; rest: string } {
  const messages: JsonRpcMessage[] = [];
  let buffer = streamBuffer;

  for (;;) {
    const separator = buffer.indexOf("\r\n\r\n");
    if (separator === -1) {
      return { messages, rest: buffer };
    }

    const header = buffer.slice(0, separator);
    const match = /Content-Length: (\d+)/i.exec(header);
    if (!match) {
      throw new Error(`Missing Content-Length header: ${header}`);
    }

    const length = Number(match[1]);
    const body = buffer.slice(separator + 4);
    if (Buffer.byteLength(body, "utf8") < length) {
      return { messages, rest: buffer };
    }

    messages.push(JSON.parse(body.slice(0, length)) as JsonRpcMessage);
    buffer = body.slice(length);
  }
}

export async function runPublishDiagnosticsTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const documentPath = path.resolve(
    process.cwd(),
    "test/fixtures/invalid/publish-diagnostics.asm"
  );
  const documentUri = `file://${documentPath.replace(/\\/g, "/")}`;
  const brokenText = ["dup     equ 1", "        lda missing", "dup     equ 2", "        adc ("].join(
    "\n"
  );
  const fixedText = ["dup     equ 1", "        lda dup", "        adc #1"].join("\n");
  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stdout = "";
  let nextId = 1;
  const pending = new Map<number, (message: JsonRpcMessage) => void>();
  const diagnosticWaiters: Array<(params: PublishDiagnosticsParams) => void> = [];

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
    const decoded = decodeMessages(stdout);
    stdout = decoded.rest;

    for (const message of decoded.messages) {
      if (message.id !== undefined) {
        pending.get(message.id)?.(message);
        pending.delete(message.id);
        continue;
      }

      if (message.method === "textDocument/publishDiagnostics") {
        const params = message.params as PublishDiagnosticsParams;
        const waiter = diagnosticWaiters.shift();
        waiter?.(params);
      }
    }
  });

  function sendRequest(method: string, params: object): Promise<JsonRpcMessage> {
    const id = nextId++;
    child.stdin.write(
      encodeMessage({
        id,
        jsonrpc: "2.0",
        method,
        params
      })
    );

    return new Promise((resolve) => {
      pending.set(id, resolve);
    });
  }

  function sendNotification(method: string, params: object): void {
    child.stdin.write(
      encodeMessage({
        jsonrpc: "2.0",
        method,
        params
      })
    );
  }

  function waitForDiagnostics(): Promise<PublishDiagnosticsParams> {
    return new Promise((resolve) => {
      diagnosticWaiters.push(resolve);
    });
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
  } finally {
    child.kill();
  }
}
