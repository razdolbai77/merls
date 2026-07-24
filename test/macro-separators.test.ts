import assert from "node:assert/strict";

import {
  getActiveMacroCallArgumentIndex,
  splitMacroCallArguments
} from "../src/asm/expansion";
import { lexSource } from "../src/asm/lexer";

export function runMacroSeparatorTest(): void {
  const line = lexSource("        Move #$00;$02 ; preserve this comment").lines[0];
  assert.ok(line);
  assert.deepEqual(
    line.tokens.map((token) => [token.kind, token.lexeme] as const),
    [
      ["identifier", "Move"],
      ["expressionOperator", "#"],
      ["numericLiteral", "$00"],
      ["expressionOperator", ";"],
      ["numericLiteral", "$02"],
      ["comment", "; preserve this comment"]
    ]
  );

  const complexTokens = (lexSource("        Move (STRING),Y;$02").lines[0]?.tokens ?? []).slice(1);
  assert.deepEqual(
    splitMacroCallArguments(complexTokens).map((argument) =>
      argument.map((token) => token.lexeme)
    ),
    [
      ["(", "STRING", ")", ",", "Y"],
      ["$02"]
    ]
  );
  const separator = complexTokens.find((token) => token.lexeme === ";");
  assert.ok(separator);
  assert.equal(getActiveMacroCallArgumentIndex(complexTokens, separator.end), 1);
}
