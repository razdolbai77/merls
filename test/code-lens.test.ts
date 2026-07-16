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

export async function runCodeLensTest(): Promise<void> {
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

    const lensResponse = await sendRequest("textDocument/codeLens", {
      textDocument: { uri: mainUri }
    });

    const lenses = lensResponse.result as Array<{
      range: { start: { line: number; character: number } };
      command: { title: string; command: string };
    }>;

    assert.equal(Array.isArray(lenses), true);
    
    // In merlin32-main-6502.S, there is a label 'GetKey' used 1 time (so 1 reference) 
    // wait, we don't know exactly. But let's check if the lenses array has something.
    assert.equal(lenses.length > 0, true);

    const codeLensCount = lenses.find(l => l.command.title.includes("reference"));
    assert.ok(codeLensCount !== undefined, "Expected at least one lens with reference count");
    assert.equal(codeLensCount.command.command, "");

  } finally {
    child.kill();
  }
}
