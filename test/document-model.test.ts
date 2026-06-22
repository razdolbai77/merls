import assert from "node:assert/strict";

import { parseDocument } from "../src/asm/document";

export function runDocumentModelTest(): void {
  const source = [
    "TEXT    =   $FB39",
    "MacroDef mac",
    "        PrintPair #',' , ]1",
    "        eom",
    "        adc (",
    "        lda #1",
    "",
    "; trailing note"
  ].join("\n");

  const document = parseDocument(source);

  assert.equal(document.lines.length, 8);
  assert.equal(document.errors.length, 1);
  assert.deepEqual(document.errors[0], {
    line: 4,
    text: "        adc (",
    message: "expected expression token"
  });

  assert.equal(document.lines[0]?.node.shape, "equate");
  assert.equal(document.lines[1]?.node.shape, "directive");
  assert.equal(document.lines[2]?.node.shape, "macroCall");
  assert.equal(document.lines[3]?.node.shape, "directive");
  assert.equal(document.lines[4]?.node.shape, "malformed");
  assert.equal(document.lines[5]?.node.shape, "instruction");
  assert.equal(document.lines[6]?.node.shape, "empty");
  assert.equal(document.lines[7]?.node.shape, "commentOnly");

  assert.equal(document.macroDefinitions.length, 1);
  assert.deepEqual(document.macroDefinitions[0], {
    name: "MacroDef",
    nameToken: { kind: "label", lexeme: "MacroDef", start: 0, end: 8 },
    startLine: 1,
    endLine: 3,
    startDirective: { kind: "directive", lexeme: "mac", start: 9, end: 12 },
    endDirective: { kind: "directive", lexeme: "eom", start: 8, end: 11 },
    body: [
      {
        line: 2,
        node: document.lines[2]?.node,
        tokens: document.lines[2]?.tokens ?? [],
        parameterReferences: [
          {
            token: { kind: "localLabel", lexeme: "]1", start: 25, end: 27 },
            index: 1
          }
        ]
      }
    ],
    parameterReferences: [
      {
        token: { kind: "localLabel", lexeme: "]1", start: 25, end: 27 },
        index: 1
      }
    ],
    maxParameterIndex: 1
  });

  assert.deepEqual(document.macroCalls, [
    {
      line: 2,
      label: null,
      macro: { kind: "identifier", lexeme: "PrintPair", start: 8, end: 17 },
      args: [
        { kind: "expressionOperator", lexeme: "#", start: 18, end: 19 },
        { kind: "string", lexeme: "','", start: 19, end: 22 },
        { kind: "expressionOperator", lexeme: ",", start: 23, end: 24 },
        { kind: "localLabel", lexeme: "]1", start: 25, end: 27 }
      ]
    }
  ]);
}
