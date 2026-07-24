import assert from "node:assert/strict";

import { SemanticTokenTypes } from "vscode-languageserver/node";

import { buildCachedDocument, parseDocument } from "../src/asm/document";
import { collectWorkspaceDiagnostics } from "../src/asm/diagnostics";
import { resolveLocalLabels } from "../src/asm/local-labels";
import { collectSymbols } from "../src/asm/symbols";
import { buildCompletionItems } from "../src/lsp/completion";
import { findDefinition } from "../src/lsp/symbol-navigation";
import { buildSemanticTokens, semanticTokensLegend } from "../src/lsp/semantic-tokens";

type DecodedSemanticToken = {
  line: number;
  character: number;
  length: number;
  type: number;
};

function decodeSemanticTokens(data: readonly number[]): readonly DecodedSemanticToken[] {
  const tokens: DecodedSemanticToken[] = [];
  let line = 0;
  let character = 0;

  for (let index = 0; index < data.length; index += 5) {
    const lineDelta = data[index] ?? 0;
    const characterDelta = data[index + 1] ?? 0;
    line += lineDelta;
    character = lineDelta === 0 ? character + characterDelta : characterDelta;
    tokens.push({
      line,
      character,
      length: data[index + 2] ?? 0,
      type: data[index + 3] ?? 0
    });
  }

  return tokens;
}

export function runVariableTest(): void {
  const source = [
    "Start",
    "]count = 0",
    "        lda ]count",
    "]count = ]count+1",
    "        sta ]count"
  ].join("\n");
  const uri = "file:///variables.S";
  const cached = buildCachedDocument(source);
  const openDocuments = new Map([[uri, cached]]);
  const symbols = collectSymbols(cached.parsed);

  assert.equal(symbols.get("]count")?.kind, "variable");
  assert.equal(symbols.get("]count")?.line, 1);

  const localScope = resolveLocalLabels(cached.parsed);
  assert.equal(localScope.definitions.get("]count@1"), undefined);
  assert.equal(localScope.references.get("]count@2"), undefined);

  const diagnostics = collectWorkspaceDiagnostics([
    { filePath: "<variables>", document: cached.parsed }
  ]);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === "duplicate-symbol"), false);
  assert.equal(diagnostics.some((diagnostic) => diagnostic.code === "unresolved-reference"), false);

  const definition = findDefinition(openDocuments, uri, 4, 13);
  assert.deepEqual(definition, {
    uri,
    range: {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 6 }
    }
  });

  const completions = buildCompletionItems(openDocuments, uri, 4, 14);
  assert.equal(completions.some((item) => item.label === "]count"), true);

  const semanticTokens = decodeSemanticTokens(
    buildSemanticTokens(cached, openDocuments).data
  );
  const variableTokenType = semanticTokensLegend.tokenTypes.indexOf(SemanticTokenTypes.variable);
  assert.equal(
    semanticTokens.some((token) =>
      token.line === 1 &&
      token.character === 0 &&
      token.length === 6 &&
      token.type === variableTokenType
    ),
    true
  );

  const forwardDocument = parseDocument([
    "Start",
    "        lda ]future",
    "]future = 1"
  ].join("\n"));
  const forwardDiagnostics = collectWorkspaceDiagnostics([
    { filePath: "<forward-variable>", document: forwardDocument }
  ]);
  assert.equal(
    forwardDiagnostics.some(
      (diagnostic) =>
        diagnostic.code === "unresolved-reference" &&
        diagnostic.message === "Unresolved variable reference ]future"
    ),
    true
  );
}
