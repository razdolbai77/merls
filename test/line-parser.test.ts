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
    label: "TEXT",
    expression: {
      kind: "numericLiteral",
      value: "$FB39"
    }
  });

  assert.deepEqual(lines[1], {
    shape: "instruction",
    text: "        adc (_tmp+dum1+1,x)",
    label: null,
    mnemonic: "adc",
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
          left: { kind: "identifier", value: "_tmp" },
          right: { kind: "identifier", value: "dum1" }
        },
        right: { kind: "numericLiteral", value: "1" }
      }
    }
  });

  assert.deepEqual(lines[2], {
    shape: "directive",
    text: "dum0    ds  1",
    label: "dum0",
    directive: "ds",
    operand: {
      kind: "numericLiteral",
      value: "1"
    }
  });

  assert.deepEqual(lines[3], {
    shape: "data",
    text: "        hex 2C",
    label: null,
    directive: "hex",
    payload: "2C"
  });

  assert.equal(lines[4]?.shape, "malformed");
}
