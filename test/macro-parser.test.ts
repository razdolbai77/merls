import assert from "node:assert/strict";

import { parseSourceStructure } from "../src/asm/parser";
import { parseDocument } from "../src/asm/document";
import { collectWorkspaceDiagnostics } from "../src/asm/diagnostics";
import { lexSource, type LexedLine } from "../src/asm/lexer";
export function runMacroParserTest(): void {
  const source = [
    "MacroDef mac",
    "        ]loop lda ]1",
    "        PrintPair #',' , ]2",
    "        bne ]loop",
    "        lda Target",
    "        eom",
    "CallSite MacroDef VALUE,OTHER"
  ].join("\n");

  const parsed = parseSourceStructure(source);
  const lexedTokens = lexSource(source).lines.map((l: LexedLine) => l.tokens);

  assert.equal(parsed.lines.length, 7);
  assert.equal(parsed.macroDefinitions.length, 1);

  assert.deepEqual(parsed.macroDefinitions[0], {
    name: "MacroDef",
    nameToken: { kind: "label", lexeme: "MacroDef", start: 0, end: 8 },
    startLine: 0,
    endLine: 5,
    startDirective: { kind: "directive", lexeme: "mac", start: 9, end: 12 },
    endDirective: { kind: "directive", lexeme: "eom", start: 8, end: 11 },
    body: [
      {
        line: 1,
        node: parsed.lines[1],
        tokens: lexedTokens[1],
        parameterReferences: [
          {
            token: { kind: "localLabel", lexeme: "]1", start: 18, end: 20 },
            index: 1
          }
        ],
        symbolReferences: [],
        nestedMacroCalls: [],
        localLabelDefinitions: [
          { token: { kind: "localLabel", lexeme: "]loop", start: 8, end: 13 } }
        ],
        localLabelReferences: []
      },
      {
        line: 2,
        node: parsed.lines[2],
        tokens: lexedTokens[2],
        parameterReferences: [
          {
            token: { kind: "localLabel", lexeme: "]2", start: 25, end: 27 },
            index: 2
          }
        ],
        symbolReferences: [],
        nestedMacroCalls: [
          {
            macro: { kind: "identifier", lexeme: "PrintPair", start: 8, end: 17 },
            args: [
              { kind: "expressionOperator", lexeme: "#", start: 18, end: 19 },
              { kind: "string", lexeme: "','", start: 19, end: 22 },
              { kind: "expressionOperator", lexeme: ",", start: 23, end: 24 },
              { kind: "localLabel", lexeme: "]2", start: 25, end: 27 }
            ]
          }
        ],
        localLabelDefinitions: [],
        localLabelReferences: []
      },
      {
        line: 3,
        node: parsed.lines[3],
        tokens: lexedTokens[3],
        parameterReferences: [],
        symbolReferences: [],
        nestedMacroCalls: [],
        localLabelDefinitions: [],
        localLabelReferences: [
          { token: { kind: "localLabel", lexeme: "]loop", start: 12, end: 17 } }
        ]
      },
      {
        line: 4,
        node: parsed.lines[4],
        tokens: lexedTokens[4],
        parameterReferences: [],
        symbolReferences: [
          { token: { kind: "identifier", lexeme: "Target", start: 12, end: 18 } }
        ],
        nestedMacroCalls: [],
        localLabelDefinitions: [],
        localLabelReferences: []
      }
    ],
    parameterReferences: [
      {
        token: { kind: "localLabel", lexeme: "]1", start: 18, end: 20 },
        index: 1
      },
      {
        token: { kind: "localLabel", lexeme: "]2", start: 25, end: 27 },
        index: 2
      }
    ],
    symbolReferences: [
      { token: { kind: "identifier", lexeme: "Target", start: 12, end: 18 } }
    ],
    nestedMacroCalls: [
      {
        macro: { kind: "identifier", lexeme: "PrintPair", start: 8, end: 17 },
        args: [
          { kind: "expressionOperator", lexeme: "#", start: 18, end: 19 },
          { kind: "string", lexeme: "','", start: 19, end: 22 },
          { kind: "expressionOperator", lexeme: ",", start: 23, end: 24 },
          { kind: "localLabel", lexeme: "]2", start: 25, end: 27 }
        ]
      }
    ],
    localLabelDefinitions: [
      { token: { kind: "localLabel", lexeme: "]loop", start: 8, end: 13 } }
    ],
    localLabelReferences: [
      { token: { kind: "localLabel", lexeme: "]loop", start: 12, end: 17 } }
    ],
    maxParameterIndex: 2
  });

  const nestedMacroSource = [
    "OuterMacro mac",
    "InnerMacro mac",
    "        nop",
    "        <<<",
    "        nop",
    "        <<<",
    "        OuterMacro"
  ].join("\n");
  const nestedParsed = parseSourceStructure(nestedMacroSource);
  assert.deepEqual(
    nestedParsed.macroDefinitions.map((definition) => definition.name),
    ["OuterMacro"]
  );
  assert.equal(nestedParsed.macroDefinitions[0]?.endLine, 5);
  assert.deepEqual(
    nestedParsed.macroDefinitions[0]?.nestedDefinitions?.map((definition) => definition.name),
    ["InnerMacro"]
  );
  assert.equal(nestedParsed.macroDefinitions[0]?.nestedDefinitions?.[0]?.endLine, 3);

  const nestedDiagnostics = collectWorkspaceDiagnostics([
    {
      filePath: "<nested-macro>",
      document: parseDocument(nestedMacroSource)
    }
  ]);
  assert.deepEqual(nestedDiagnostics, []);
}
