import assert from "node:assert/strict";

import { parseDocument } from "../src/asm/document";
import { collectWorkspaceDiagnostics } from "../src/asm/diagnostics";
import { expandMacroCall } from "../src/asm/expansion";
import { lexSource } from "../src/asm/lexer";
import { parseSourceLines } from "../src/asm/parser";
import { collectDocumentMacros } from "../src/asm/macros";

export function runAlternateMacroCallTest(): void {
  assert.deepEqual(
    lexSource("        >>> AltMacro $12").lines[0]?.tokens.slice(0, 2).map((token) => [token.kind, token.lexeme]),
    [["directive", ">>>"], ["identifier", "AltMacro"]]
  );
  assert.deepEqual(
    lexSource("        pmc AltMacro $12").lines[0]?.tokens.slice(0, 2).map((token) => [token.kind, token.lexeme]),
    [["directive", "pmc"], ["identifier", "AltMacro"]]
  );

  const pmcLine = parseSourceLines("        pmc AltMacro VALUE,OTHER")[0];
  assert.equal(pmcLine?.shape, "macroCall");
  if (pmcLine?.shape === "macroCall") {
    assert.equal(pmcLine.macro.lexeme, "AltMacro");
    assert.deepEqual(pmcLine.args.map((token) => token.lexeme), ["VALUE", ",", "OTHER"]);
  }

  const alternateLine = parseSourceLines("        >>> AltMacro VALUE")[0];
  assert.equal(alternateLine?.shape, "macroCall");
  if (alternateLine?.shape === "macroCall") {
    assert.equal(alternateLine.macro.lexeme, "AltMacro");
    assert.deepEqual(alternateLine.args.map((token) => token.lexeme), ["VALUE"]);
  }

  const labeledAlternateLine = parseSourceLines("Loop    pmc AltMacro")[0];
  assert.equal(labeledAlternateLine?.shape, "macroCall");
  if (labeledAlternateLine?.shape === "macroCall") {
    assert.equal(labeledAlternateLine.label?.lexeme, "Loop");
    assert.equal(labeledAlternateLine.macro.lexeme, "AltMacro");
  }

  const barePmcLine = parseSourceLines("        pmc")[0];
  assert.equal(barePmcLine?.shape, "malformed");

  const bareAlternateLine = parseSourceLines("        >>>")[0];
  assert.equal(bareAlternateLine?.shape, "malformed");

  const expansionSource = [
    "AltMacro mac",
    "        lda ]1",
    "        eom",
    "        pmc AltMacro $42",
    "        >>> AltMacro $77"
  ].join("\n");
  const expansionDocument = parseDocument(expansionSource);

  assert.deepEqual(
    expansionDocument.macroCalls.map((call) => ({ line: call.line, macro: call.macro.lexeme })),
    [
      { line: 3, macro: "AltMacro" },
      { line: 4, macro: "AltMacro" }
    ]
  );

  const pmcCall = expansionDocument.lines[3];
  assert.ok(pmcCall !== undefined && pmcCall.node.shape === "macroCall");
  if (pmcCall.node.shape === "macroCall") {
    const expansion = expandMacroCall(pmcCall.node, expansionDocument.macroDefinitions);
    assert.deepEqual(expansion.lines.map((line) => line.text), ["        lda $42"]);
  }

  const nestedCalls = collectDocumentMacros(expansionDocument);
  assert.equal(nestedCalls.get("AltMacro")?.startLine, 0);

  const expansionDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<alternate-expansion>", document: expansionDocument }
  ]);
  assert.deepEqual(expansionDiagnostics, []);

  const diagnosticsSource = [
    "        pmc MissingAlt VALUE",
    "        >>> MissingAlt"
  ].join("\n");
  const alternateDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<alternate-missing>", document: parseDocument(diagnosticsSource) }
  ]);
  assert.equal(
    alternateDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "unsupported-instruction" &&
        diagnostic.line === 0 &&
        diagnostic.message === "Unsupported instruction or undefined macro: MissingAlt"
    ),
    true
  );
  assert.equal(
    alternateDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "unsupported-instruction" &&
        diagnostic.line === 1 &&
        diagnostic.message === "Unsupported instruction or undefined macro: MissingAlt"
    ),
    true
  );

  const aritySource = [
    "ArityMacro mac",
    "        lda ]1",
    "        sta ]2",
    "        eom",
    "        pmc ArityMacro $01"
  ].join("\n");
  const arityDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<alternate-arity>", document: parseDocument(aritySource) }
  ]);
  assert.equal(
    arityDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "macro-arity-mismatch" &&
        diagnostic.message === "Macro ArityMacro expected 2 argument(s) but received 1"
    ),
    true
  );
}
