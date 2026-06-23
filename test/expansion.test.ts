import assert from "node:assert/strict";
import { lexSource } from "../src/asm/lexer";
import { parseSourceStructure } from "../src/asm/parser";
import { expandMacroCall } from "../src/asm/expansion";

export async function runExpansionTest(): Promise<void> {
  const source = [
    "Wrap mac",
    "     lda ]1",
    "     sta ]2",
    "     eom",
    "     Wrap $12,$34"
  ].join("\n");

  const lexed = lexSource(source);
  const parsed = parseSourceStructure(lexed);
  const callLine = parsed.lines.find(line => line.shape === "macroCall");
  assert.ok(callLine !== undefined && callLine.shape === "macroCall");

  const expansion = expandMacroCall(callLine, parsed.macroDefinitions);
  
  assert.equal(expansion.lines.length, 2);
  assert.equal(expansion.lines[0]?.text, "     lda $12");
  assert.equal(expansion.lines[1]?.text, "     sta $34");
  
  // Verify token source maps
  const ldaToken = expansion.lines[0]?.tokens[0];
  assert.ok(ldaToken);
  assert.equal(ldaToken.lexeme, "lda");
  assert.equal(ldaToken.sourceToken.lexeme, "lda"); // maps to definition

  const arg1Token = expansion.lines[0]?.tokens[1];
  assert.ok(arg1Token);
  assert.equal(arg1Token.lexeme, "$12");
  assert.equal(arg1Token.sourceToken.lexeme, "$12"); // maps to call site
}
