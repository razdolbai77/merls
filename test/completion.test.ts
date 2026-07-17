import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startJsonRpcClient } from "./helpers/json-rpc-client";







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

function positionAfterLast(text: string, needle: string): { line: number; character: number } {
  const position = positionOfLast(text, needle);
  return {
    line: position.line,
    character: position.character + needle.length
  };
}

export async function runCompletionTest(): Promise<void> {
  const serverPath = path.resolve(__dirname, "../src/server.js");
  const mainPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-main-6502.S"
  );
  const mainUri = `file://${mainPath.replace(/\\/g, "/")}`;
  const text = `${fs.readFileSync(mainPath, "utf8")}\n        ld\n        du\n        bpl G\nCompletionStart nop\n]local nop\n:loop   nop\n        bne ]l\n        bne :l\nCompletionOther nop\n]other nop\n:other nop\n        bne ]o\n        bne :o\n_END_`;

  const macroPath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-macro-coverage.S"
  );
  const macroUri = `file://${macroPath.replace(/\\/g, "/")}`;
  const macroText = `${fs.readFileSync(macroPath, "utf8")}\n        Outer VA\n        Ou`;

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

    const opcodeResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: mainUri },
      position: positionOfLast(text, "ld")
    });
    const opcodeItems = opcodeResponse.result as Array<{ label: string }>;
    assert.equal(opcodeItems.some((item) => item.label === "lda"), true);

    const directiveResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: mainUri },
      position: positionOfLast(text, "du")
    });
    const directiveItems = directiveResponse.result as Array<{ label: string }>;
    assert.equal(directiveItems.some((item) => item.label === "dum"), true);

    const symbolResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: mainUri },
      position: positionOfLast(text, "bpl G")
    });
    const symbolItems = symbolResponse.result as Array<{ label: string; kind: number }>;
    assert.equal(symbolItems.some((item) => item.label === "GetKey"), true);

    const bracketLocalLabelPosition = positionAfterLast(text, "]l");
    const bracketLocalLabelResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: mainUri },
      position: bracketLocalLabelPosition
    });
    const bracketLocalLabelItems = bracketLocalLabelResponse.result as Array<{
      label: string;
      textEdit?: {
        newText: string;
        range: { start: { character: number }; end: { character: number } };
      };
    }>;
    const bracketLocalLabel = bracketLocalLabelItems.find((item) => item.label === "]local");
    assert.equal(bracketLocalLabelItems.some((item) => item.label === "]other"), false);
    assert.deepEqual(bracketLocalLabel?.textEdit, {
      newText: "]local",
      range: {
        start: {
          line: bracketLocalLabelPosition.line,
          character: bracketLocalLabelPosition.character - 2
        },
        end: bracketLocalLabelPosition
      }
    });

    const colonLocalLabelPosition = positionAfterLast(text, ":l");
    const colonLocalLabelResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: mainUri },
      position: colonLocalLabelPosition
    });
    const colonLocalLabelItems = colonLocalLabelResponse.result as Array<{
      label: string;
      textEdit?: {
        newText: string;
        range: { start: { character: number }; end: { character: number } };
      };
    }>;
    const colonLocalLabel = colonLocalLabelItems.find((item) => item.label === ":loop");
    assert.equal(colonLocalLabelItems.some((item) => item.label === ":other"), false);
    assert.deepEqual(colonLocalLabel?.textEdit, {
      newText: ":loop",
      range: {
        start: {
          line: colonLocalLabelPosition.line,
          character: colonLocalLabelPosition.character - 2
        },
        end: colonLocalLabelPosition
      }
    });

    const otherBracketLocalLabelResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: mainUri },
      position: positionAfterLast(text, "]o")
    });
    const otherBracketLocalLabelItems = otherBracketLocalLabelResponse.result as Array<{
      label: string;
    }>;
    assert.equal(otherBracketLocalLabelItems.some((item) => item.label === "]other"), true);
    assert.equal(otherBracketLocalLabelItems.some((item) => item.label === "]local"), false);

    const otherColonLocalLabelResponse = await sendRequest("textDocument/completion", {
      textDocument: { uri: mainUri },
      position: positionAfterLast(text, ":o")
    });
    const otherColonLocalLabelItems = otherColonLocalLabelResponse.result as Array<{
      label: string;
    }>;
    assert.equal(otherColonLocalLabelItems.some((item) => item.label === ":other"), true);
    assert.equal(otherColonLocalLabelItems.some((item) => item.label === ":loop"), false);

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
    stop();
  }
}
