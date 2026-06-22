import assert from "node:assert/strict";

import { parseDocument } from "../src/asm/document";
import { buildMacroSubstitution } from "../src/asm/substitution";

export function runMacroSubstitutionTest(): void {
  const document = parseDocument([
    "UseTwice mac",
    "        lda ]1",
    "        sta ]1",
    "        adc ]2",
    "        eom",
    "CollectOne mac",
    "        lda ]1",
    "        eom",
    "        UseTwice Target+Offset,Other",
    "        CollectOne (Alpha+Beta),Gamma"
  ].join("\n"));

  const substitution = buildMacroSubstitution(document, document.macroCalls[0]!);

  assert.deepEqual(substitution, {
    macroName: "UseTwice",
    callLine: 8,
    parameterSubstitutions: [
      {
        parameterIndex: 1,
        argumentTokens: [
          { kind: "identifier", lexeme: "Target", start: 17, end: 23 },
          { kind: "expressionOperator", lexeme: "+", start: 23, end: 24 },
          { kind: "identifier", lexeme: "Offset", start: 24, end: 30 }
        ],
        referencedSymbols: ["Target", "Offset"],
        bodyReferences: [
          {
            line: 1,
            token: { kind: "localLabel", lexeme: "]1", start: 12, end: 14 }
          },
          {
            line: 2,
            token: { kind: "localLabel", lexeme: "]1", start: 12, end: 14 }
          }
        ]
      },
      {
        parameterIndex: 2,
        argumentTokens: [
          { kind: "identifier", lexeme: "Other", start: 31, end: 36 }
        ],
        referencedSymbols: ["Other"],
        bodyReferences: [
          {
            line: 3,
            token: { kind: "localLabel", lexeme: "]2", start: 12, end: 14 }
          }
        ]
      }
    ],
    unusedArguments: []
  });

  const unusedArgumentSubstitution = buildMacroSubstitution(document, document.macroCalls[1]!);
  assert.deepEqual(unusedArgumentSubstitution, {
    macroName: "CollectOne",
    callLine: 9,
    parameterSubstitutions: [
      {
        parameterIndex: 1,
        argumentTokens: [
          { kind: "expressionOperator", lexeme: "(", start: 19, end: 20 },
          { kind: "identifier", lexeme: "Alpha", start: 20, end: 25 },
          { kind: "expressionOperator", lexeme: "+", start: 25, end: 26 },
          { kind: "identifier", lexeme: "Beta", start: 26, end: 30 },
          { kind: "expressionOperator", lexeme: ")", start: 30, end: 31 }
        ],
        referencedSymbols: ["Alpha", "Beta"],
        bodyReferences: [
          {
            line: 6,
            token: { kind: "localLabel", lexeme: "]1", start: 12, end: 14 }
          }
        ]
      },
      {
        parameterIndex: 2,
        argumentTokens: [
          { kind: "identifier", lexeme: "Gamma", start: 32, end: 37 }
        ],
        referencedSymbols: ["Gamma"],
        bodyReferences: []
      }
    ],
    unusedArguments: [2]
  });
}
