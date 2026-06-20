import assert from "node:assert/strict";

import { parseSourceLines } from "../src/asm/parser";

export function runLineParserTest(): void {
  const source = [
    "TEXT    =   $FB39",
    "        adc (_tmp+dum1+1,x)",
    "dum0    ds  1",
    "        hex 2C",
    "        adc ("
  ].join("\n");

  const lines = parseSourceLines(source);

  assert.deepEqual(lines[0], {
    shape: "equate",
    text: "TEXT    =   $FB39",
    label: { kind: "label", lexeme: "TEXT", start: 0, end: 4 },
    expression: {
      kind: "numericLiteral",
      value: "$FB39"
    }
  });

  assert.deepEqual(lines[1], {
    shape: "instruction",
    text: "        adc (_tmp+dum1+1,x)",
    label: null,
    mnemonic: { kind: "mnemonic", lexeme: "adc", start: 8, end: 11 },
    operand: {
      immediate: false,
      indirect: true,
      indexRegister: "x",
      expression: {
        kind: "binary",
        operator: "+",
        left: {
          kind: "binary",
          operator: "+",
          left: { kind: "identifier", value: "_tmp", token: { kind: "identifier", lexeme: "_tmp", start: 13, end: 17 } },
          right: { kind: "identifier", value: "dum1", token: { kind: "identifier", lexeme: "dum1", start: 18, end: 22 } }
        },
        right: { kind: "numericLiteral", value: "1" }
      }
    }
  });

  assert.deepEqual(lines[2], {
    shape: "directive",
    text: "dum0    ds  1",
    label: { kind: "label", lexeme: "dum0", start: 0, end: 4 },
    directive: { kind: "directive", lexeme: "ds", start: 8, end: 10 },
    operand: {
      kind: "numericLiteral",
      value: "1"
    }
  });

  assert.deepEqual(lines[3], {
    shape: "data",
    text: "        hex 2C",
    label: null,
    directive: { kind: "directive", lexeme: "hex", start: 8, end: 11 },
    payload: "2C"
  });

  assert.equal(lines[4]?.shape, "malformed");
}
