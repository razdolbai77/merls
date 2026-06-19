import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type LexedLine,
  type Token,
  lexSource
} from "../src/asm/lexer";

function summarizeTokens(tokens: readonly Token[]): readonly (readonly [string, string])[] {
  return tokens.map((token) => [token.kind, token.lexeme] as const);
}

function findLine(lines: readonly LexedLine[], source: string): LexedLine {
  const line = lines.find((candidate) => candidate.text === source);
  assert.ok(line, `expected to find line: ${source}`);
  return line;
}

export function runLexerTest(): void {
  const mainFixturePath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-main-6502.asm"
  );
  const linkFixturePath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-linkscript.asm"
  );

  const mainFixture = fs.readFileSync(mainFixturePath, "utf8");
  const linkFixture = fs.readFileSync(linkFixturePath, "utf8");

  const mainLines = lexSource(mainFixture).lines;
  const linkLines = lexSource(linkFixture).lines;

  assert.deepEqual(
    summarizeTokens(findLine(mainLines, "; Source: apple2accumulator/merlin32").tokens),
    [["comment", "; Source: apple2accumulator/merlin32"]]
  );

  assert.deepEqual(
    summarizeTokens(findLine(mainLines, "TEXT    =   $FB39").tokens),
    [
      ["label", "TEXT"],
      ["expressionOperator", "="],
      ["numericLiteral", "$FB39"]
    ]
  );

  assert.deepEqual(
    summarizeTokens(findLine(mainLines, "        DUM 0").tokens),
    [
      ["directive", "DUM"],
      ["numericLiteral", "0"]
    ]
  );

  assert.deepEqual(
    summarizeTokens(findLine(mainLines, "        adc ($80,x)").tokens),
    [
      ["mnemonic", "adc"],
      ["expressionOperator", "("],
      ["numericLiteral", "$80"],
      ["expressionOperator", ","],
      ["identifier", "x"],
      ["expressionOperator", ")"]
    ]
  );

  assert.deepEqual(
    summarizeTokens(findLine(mainLines, "GetKey  ldx $C000").tokens),
    [
      ["label", "GetKey"],
      ["mnemonic", "ldx"],
      ["numericLiteral", "$C000"]
    ]
  );

  assert.deepEqual(
    summarizeTokens(findLine(linkLines, "    asm main.s").tokens),
    [
      ["directive", "asm"],
      ["identifier", "main.s"]
    ]
  );
}
