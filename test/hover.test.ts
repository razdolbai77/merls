import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startJsonRpcClient } from "./helpers/json-rpc-client";
import { buildCachedDocument } from "../src/asm/document";
import { buildHover } from "../src/lsp/hover";







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

    const regUri = "file:///workspace/registers.S";
    const regText = [
      "a       EQU $00",
      "        lsr a",
      "        lda foo, x",
      "        lda foo, y",
      "        lda a",
      "foo     nop"
    ].join("\n");
    const regCached = buildCachedDocument(regText);
    const openDocuments = new Map([[regUri, regCached]]);
    
    // LSR a (Accumulator mode)
    const hoverLsrA = buildHover(openDocuments, regUri, 1, 12);
    assert.ok(hoverLsrA);
    assert.equal((hoverLsrA.contents as string).includes("Register A"), true);
    
    // LDA foo, x (Index register X)
    const hoverLdaX = buildHover(openDocuments, regUri, 2, 17);
    assert.ok(hoverLdaX);
    assert.equal((hoverLdaX.contents as string).includes("Register X"), true);
    
    // LDA foo, y (Index register Y)
    const hoverLdaY = buildHover(openDocuments, regUri, 3, 17);
    assert.ok(hoverLdaY);
    assert.equal((hoverLdaY.contents as string).includes("Register Y"), true);
    
    // LDA a (Variable 'a', not accumulator)
    const hoverLdaVarA = buildHover(openDocuments, regUri, 4, 12);
    assert.ok(hoverLdaVarA);
    assert.equal(typeof hoverLdaVarA.contents === "string" ? hoverLdaVarA.contents.includes("Register A") : false, false);
  } finally {
    stop();
  }
}
