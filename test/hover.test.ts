import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { buildCachedDocument } from "../src/asm/document";
import { buildHover } from "../src/lsp/hover";

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

function positionOfInMatch(
  text: string,
  needle: string,
  offset: number
): { line: number; character: number } {
  const base = positionOf(text, needle);
  return {
    line: base.line,
    character: base.character + offset
  };
}

export async function runHoverTest(): Promise<void> {
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

    const opcodeHover = await sendRequest("textDocument/hover", {
      textDocument: { uri: mainUri },
      position: positionOf(text, "adc (_tmp")
    });
    const opcodeResult = opcodeHover.result as { contents: string | { value: string } };
    const opcodeText =
      typeof opcodeResult.contents === "string"
        ? opcodeResult.contents
        : opcodeResult.contents.value;
    assert.equal(opcodeText.includes("adc"), true);

    const directiveHover = await sendRequest("textDocument/hover", {
      textDocument: { uri: mainUri },
      position: positionOf(text, "DUM 0")
    });
    const directiveResult = directiveHover.result as { contents: string | { value: string } };
    const directiveText =
      typeof directiveResult.contents === "string"
        ? directiveResult.contents
        : directiveResult.contents.value;
    assert.equal(directiveText.includes("dum"), true);

    const symbolHover = await sendRequest("textDocument/hover", {
      textDocument: { uri: mainUri },
      position: positionOfInMatch(text, "bpl GetKey", 4)
    });
    const symbolResult = symbolHover.result as { contents: string | { value: string } };
    const symbolText =
      typeof symbolResult.contents === "string"
        ? symbolResult.contents
        : symbolResult.contents.value;
    assert.equal(symbolText.includes("GetKey"), true);

    const macroUri = "file:///workspace/macro-hover.S";
    const macroText = [
      "Wrap mac",
      "        lda ]1",
      "        sta ]2",
      "        eom",
      "Target",
      "        Wrap Target,Target"
    ].join("\n");
    const macroCached = buildCachedDocument(macroText);
    const macroHover = buildHover(new Map([[macroUri, macroCached]]), macroUri, 5, 10);
    assert.ok(macroHover);
    const macroHoverText = typeof macroHover.contents === "string"
      ? macroHover.contents
      : Array.isArray(macroHover.contents)
        ? macroHover.contents.map((entry) => typeof entry === "string" ? entry : entry.value).join("\n")
        : macroHover.contents.value;
    assert.equal(macroHoverText.includes("Wrap(]1, ]2)"), true);
    assert.equal(macroHoverText.includes("defined at line 1"), true);
  } finally {
    child.kill();
  }
}
