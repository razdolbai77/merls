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

  assert.deepEqual(symbols.get("TEXT"), {
    name: "TEXT",
    kind: "equate",
    line: 11
  });

  assert.deepEqual(symbols.get("TEST_START"), {
    name: "TEST_START",
    kind: "label",
    line: 31
  });

  assert.deepEqual(symbols.get("dum0"), {
    name: "dum0",
    kind: "data",
    line: 17
  });

  assert.deepEqual(symbols.get("_num1"), {
    name: "_num1",
    kind: "data",
    line: 25
  });
}
