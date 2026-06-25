import assert from "node:assert/strict";
import { lexSource } from "../src/asm/lexer";
import { parseDocument } from "../src/asm/document";
import { expandMacroCall, getEffectiveLines } from "../src/asm/expansion";

export async function runExpansionTest(): Promise<void> {
  const source = [
    "Wrap mac",
    "     lda ]1",
    "     sta ]2",
    "     eom",
    "     Wrap $12,$34"
  ].join("\n");

  const lexed = lexSource(source);
  const parsed = parseDocument(lexed);
  const callLine = parsed.lines.find(line => line.node.shape === "macroCall");
  assert.ok(callLine !== undefined && callLine.node.shape === "macroCall");

  const expansion = expandMacroCall(callLine.node, parsed.macroDefinitions);
  
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

  // Verify caching
  const expansion2 = expandMacroCall(callLine.node, parsed.macroDefinitions);
  assert.equal(expansion, expansion2, "expansion should be cached");

  // Verify invalidation if definition changes
  const otherDef = { ...parsed.macroDefinitions[0]! };
  const expansion3 = expandMacroCall(callLine.node, [otherDef]);
  assert.notEqual(expansion, expansion3, "expansion should be invalidated if definition changes");

  // Verify getEffectiveLines caching
  const effectiveLines = getEffectiveLines(parsed, parsed.macroDefinitions);
  const effectiveLines2 = getEffectiveLines(parsed, parsed.macroDefinitions);
  assert.equal(effectiveLines, effectiveLines2, "effectiveLines should be cached");

  // Verify getEffectiveLines cache invalidation
  const effectiveLines3 = getEffectiveLines(parsed, [otherDef]);
  assert.notEqual(effectiveLines, effectiveLines3, "effectiveLines should be invalidated if definitions change");
}
