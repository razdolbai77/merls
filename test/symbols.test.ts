import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { parseDocument } from "../src/asm/document";
import { collectSymbols } from "../src/asm/symbols";

export function runSymbolsTest(): void {
  const fixturePath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-main-6502.S"
  );
  const source = fs.readFileSync(fixturePath, "utf8");

  const document = parseDocument(source);
  const symbols = collectSymbols(document);

  assert.equal(symbols.get("TEXT")?.name, "TEXT");
  assert.equal(symbols.get("TEXT")?.kind, "equate");
  assert.equal(symbols.get("TEXT")?.line, 11);
  assert.deepEqual(symbols.get("TEXT")?.token, {
    kind: "label",
    lexeme: "TEXT",
    start: 0,
    end: 4
  });
  assert.equal(symbols.get("TEXT")?.macroDefinition, null);

  assert.equal(symbols.get("TEST_START")?.kind, "label");
  assert.equal(symbols.get("TEST_START")?.line, 32);

  assert.equal(symbols.get("dum0")?.kind, "data");
  assert.equal(symbols.get("dum0")?.line, 18);

  assert.equal(symbols.get("_num1")?.kind, "data");
  assert.equal(symbols.get("_num1")?.line, 26);

  assert.equal(symbols.get("MY_VAL")?.kind, "equate");
  assert.equal(symbols.get("MY_VAL")?.line, 15);

  const macroDocument = parseDocument([
    "PrintPair mac",
    "        lda ]1",
    "        sta ]2",
    "        eom"
  ].join("\n"));
  const macroSymbols = collectSymbols(macroDocument);
  assert.deepEqual(macroSymbols.get("PrintPair"), {
    name: "PrintPair",
    kind: "macro",
    line: 0,
    token: { kind: "label", lexeme: "PrintPair", start: 0, end: 9 },
    macroDefinition: {
      name: "PrintPair",
      line: 0,
      startLine: 0,
      endLine: 3,
      bodyStartLine: 1,
      bodyEndLine: 2,
      maxParameterIndex: 2,
      referencedSymbols: [],
      nestedCalls: [],
      localLabelDefinitions: [],
      localLabelReferences: []
    }
  });
}
