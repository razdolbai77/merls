import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

type JsonRpcMessage = {
  id?: number;
  jsonrpc: "2.0";
  result?: unknown;
};

type SelectionRangeResponse = {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  parent?: SelectionRangeResponse;
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

export async function runSelectionRangeTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const mainPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-main-6502.S"
  );
  const mainUri = `file://${mainPath.replace(/\\/g, "/")}`;
  const text = fs.readFileSync(mainPath, "utf8");
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
      rootUri: `file://${path.resolve(process.cwd()).replace(/\\/g, "/")}`
    });

    sendNotification("initialized", {});
    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: mainUri,
        languageId: "asm",
        version: 1,
        text
      }
    });

    const response = await sendRequest("textDocument/selectionRange", {
      textDocument: { uri: mainUri },
      positions: [{ line: 70, character: 4 }] // "GetKey" or something nearby
    });

    const ranges = response.result as Array<SelectionRangeResponse>;

    assert.equal(Array.isArray(ranges), true);
    assert.equal(ranges.length, 1);
    
    // Check nested structure
    const range0 = ranges[0]; // token
    assert.ok(range0.parent !== undefined, "Expected parent range");
    
    const range1 = range0.parent; // line
    assert.ok(range1.parent !== undefined, "Expected parent range for line");

    const range2 = range1.parent; // scope
    assert.ok(range2.parent !== undefined, "Expected parent range for scope");

    const range3 = range2.parent; // file
    assert.equal(range3.parent, undefined, "File range should have no parent");

  } finally {
    child.kill();
  }
}
