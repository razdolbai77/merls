import assert from "node:assert/strict";

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
}
