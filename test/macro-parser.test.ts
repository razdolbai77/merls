import assert from "node:assert/strict";

import { parseSourceStructure } from "../src/asm/parser";

export function runMacroParserTest(): void {
  const source = [
    "MacroDef mac",
    "        PrintPair #',' , ]1",
    "        lda ]2",
    "        eom",
    "CallSite PrintPair #1,VALUE"
  ].join("\n");

  const parsed = parseSourceStructure(source);

  assert.equal(parsed.lines.length, 5);
  assert.equal(parsed.macroDefinitions.length, 1);

  assert.deepEqual(parsed.macroDefinitions[0], {
    name: "MacroDef",
    nameToken: { kind: "label", lexeme: "MacroDef", start: 0, end: 8 },
    startLine: 0,
    endLine: 3,
    startDirective: { kind: "directive", lexeme: "mac", start: 9, end: 12 },
    endDirective: { kind: "directive", lexeme: "eom", start: 8, end: 11 },
    body: [
      {
        line: 1,
        node: parsed.lines[1],
        parameterReferences: [
          {
            token: { kind: "localLabel", lexeme: "]1", start: 25, end: 27 },
            index: 1
          }
        ]
      },
      {
        line: 2,
        node: parsed.lines[2],
        parameterReferences: [
          {
            token: { kind: "localLabel", lexeme: "]2", start: 12, end: 14 },
            index: 2
          }
        ]
      }
    ],
    parameterReferences: [
      {
        token: { kind: "localLabel", lexeme: "]1", start: 25, end: 27 },
        index: 1
      },
      {
        token: { kind: "localLabel", lexeme: "]2", start: 12, end: 14 },
        index: 2
      }
    ],
    maxParameterIndex: 2
  });
}
