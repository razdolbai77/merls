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

function positionOfLast(text: string, needle: string): { line: number; character: number } {
  const index = text.lastIndexOf(needle);
  assert.notEqual(index, -1, `expected to find last ${needle}`);
  const prefix = text.slice(0, index);
  const lines = prefix.split("\n");
  return {
    line: lines.length - 1,
    character: lines.at(-1)?.length ?? 0
  };
}

export async function runCompletionTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const mainPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-main-6502.S"
  );
  const mainUri = `file://${mainPath.replace(/\\/g, "/")}`;
  const text = `${fs.readFileSync(mainPath, "utf8")}\n        ld\n        du\n        bpl G\n_END_`;

  const macroPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-macro-coverage.S"
  );
  const macroUri = `file://${macroPath.replace(/\\/g, "/")}`;
  const macroText = `${fs.readFileSync(macroPath, "utf8")}\n        Outer VA\n        Ou`;

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

    const opcodeResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: mainUri },
      position: positionOf(text, "ld")
    });
    const opcodeItems = opcodeResponse.result as Array<{ label: string }>;
    assert.equal(opcodeItems.some((item) => item.label === "lda"), true);

    const directiveResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: mainUri },
      position: positionOf(text, "du")
    });
    const directiveItems = directiveResponse.result as Array<{ label: string }>;
    assert.equal(directiveItems.some((item) => item.label === "dum"), true);

    const symbolResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: mainUri },
      position: positionOf(text, "bpl G")
    });
    const symbolItems = symbolResponse.result as Array<{ label: string; kind: number }>;
    assert.equal(symbolItems.some((item) => item.label === "GetKey"), true);

    const column1Response = await sendRequest("textDocument/completion", {
      textDocument: { uri: mainUri },
      position: positionOf(text, "_END_")
    });
    const column1Items = column1Response.result as Array<{ label: string }>;
    assert.equal(column1Items.some((item) => item.label === "lda"), false);

    sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: macroUri,
        languageId: "asm",
        version: 1,
        text: macroText
      }
    });

    const macroParamResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: macroUri },
      position: positionOf(macroText, "]1")
    });
    const macroParamItems = macroParamResponse.result as Array<{ label: string }>;
    assert.equal(macroParamItems.some((item) => item.label === "]1"), true);
    assert.equal(macroParamItems.some((item) => item.label === "]2"), true);

    const macroNameResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: macroUri },
      position: positionOfLast(macroText, "Ou")
    });
    const macroNameItems = macroNameResponse.result as Array<{ label: string; kind: number }>;
    assert.equal(macroNameItems.some((item) => item.label === "Outer" && item.kind === 3), true); // 3 = Function

    const macroArgResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: macroUri },
      position: positionOfLast(macroText, "VA")
    });
    const macroArgItems = macroArgResponse.result as Array<{ label: string; kind: number }>;
    assert.equal(macroArgItems.some((item) => item.label === "VALUE"), true);
    assert.equal(macroArgItems.some((item) => item.label === "lda"), false); // Should not offer opcodes here
  } finally {
    child.kill();
  }
}
