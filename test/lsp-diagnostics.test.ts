import assert from "node:assert/strict";

import { buildCachedDocument } from "../src/asm/document";
import { collectDiagnosticsByUri } from "../src/lsp/diagnostics";

export function runLspDiagnosticsTest(): void {
  const document = buildCachedDocument("Subroutine\n");
  const openUri = "file:///C:/workspace/main.S";
  const aliasUri = `${openUri}#same-file`;
  const openDocuments = new Map([[openUri, document]]);
  const indexedDocuments = new Map([
    [openUri, document],
    [aliasUri, document]
  ]);

  const diagnosticsByUri = collectDiagnosticsByUri(openDocuments, indexedDocuments);

  assert.deepEqual(diagnosticsByUri.get(openUri), []);
}
