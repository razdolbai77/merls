import assert from "node:assert/strict";

import { buildCachedDocument, CachedDocument } from "../src/asm/document";
import { buildCompletionItems } from "../src/lsp/completion";

export function runCompletionSuppressionTest(): void {
  const uri = "file:///suppression.S";
  const source = "Target\n  lda Target ; note\n  asc \"payload\"\n";
  const documents = new Map<string, CachedDocument>([
    [uri, buildCachedDocument(source)]
  ]);
  const lines = source.split("\n");
  const commentLine = lines[1];
  const commentStart = commentLine.indexOf(";");
  const insideComment = commentStart + 3;

  // Cursor exactly at the comment's first character gets no completions.
  assert.deepEqual(
    buildCompletionItems(documents, uri, 1, commentStart),
    []
  );

  // Cursor inside the comment still gets no completions.
  assert.deepEqual(
    buildCompletionItems(documents, uri, 1, insideComment),
    []
  );

  // Cursor on the operand before the comment still completes.
  const beforeComment = buildCompletionItems(documents, uri, 1, commentLine.indexOf("Target"));
  assert.ok(beforeComment.length > 0);

  // Cursor exactly at a string token's opening quote gets no completions.
  const quoteStart = lines[2].indexOf('"');
  assert.deepEqual(
    buildCompletionItems(documents, uri, 2, quoteStart),
    []
  );

  // A fresh line after the commented lines completes again.
  const nextLine = buildCompletionItems(documents, uri, 3, 2);
  assert.ok(nextLine.length > 0);
}
