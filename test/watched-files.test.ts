import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

type JsonRpcMessage = {
  id?: number;
  jsonrpc: "2.0";
  result?: unknown;
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

export async function runWatchedFilesTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const workspacePath = path.resolve(process.cwd(), "test/fixtures/valid");
  
  // We'll simulate a file changing on disk
  const testFilePath = path.resolve(workspacePath, "watched-test.S");
  const testFileUri = `file://${testFilePath.replace(/\\/g, "/")}`;

  fs.writeFileSync(testFilePath, "NewSymbol  equ $1234\n");

  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stdout = "";
  let nextId = 1;
  const pending = new Map<number, (message: JsonRpcMessage) => void>();

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
    const decoded = decodeMessages(stdout);
    stdout = decoded.rest;

    for (const message of decoded.messages) {
      if (message.id !== undefined) {
        pending.get(message.id)?.(message);
        pending.delete(message.id);
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

  try {
    await sendRequest("initialize", {
      capabilities: {},
      processId: process.pid,
      rootUri: `file://${workspacePath.replace(/\\/g, "/")}`
    });

    sendNotification("initialized", {});

    // Notify that a file was created/changed
    sendNotification("workspace/didChangeWatchedFiles", {
      changes: [
        {
          uri: testFileUri,
          type: 1 // Created
        }
      ]
    });

    // Wait a bit for processing
    await new Promise(r => setTimeout(r, 100));

    // Request workspace symbols and see if NewSymbol is found
    const symbolsResponse = await sendRequest("workspace/symbol", {
      query: "NewSymbol"
    });

    const symbols = symbolsResponse.result as Array<{ name: string }>;
    assert.equal(Array.isArray(symbols), true);
    assert.equal(symbols.some(s => s.name === "NewSymbol"), true);

  } finally {
    child.kill();
    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}
