import {
  Connection,
  ProposedFeatures,
  TextDocumentSyncKind,
  createConnection
} from "vscode-languageserver/node";

import { buildCachedDocument, type CachedDocument } from "./asm/document";
import { buildDocumentSymbols } from "./lsp/document-symbols";
import { buildCompletionItems } from "./lsp/completion";
import { collectDiagnosticsByUri } from "./lsp/diagnostics";
import { buildHover } from "./lsp/hover";
import { findDefinition, findReferences } from "./lsp/symbol-navigation";
import { buildWorkspaceSymbols } from "./lsp/workspace-symbols";
import { buildSemanticTokens, semanticTokensLegend } from "./lsp/semantic-tokens";
import { formatDocument } from "./lsp/formatting";
import { buildRenameEdits } from "./lsp/rename";
import { buildFoldingRanges } from "./lsp/folding";
import { buildDocumentLinks } from "./lsp/document-links";
import { buildDocumentHighlights } from "./lsp/document-highlights";
import { buildInlayHints } from "./lsp/inlay-hints";

export function createServerConnection(
  inputStream: NodeJS.ReadableStream = process.stdin,
  outputStream: NodeJS.WritableStream = process.stdout
): Connection {
  return createConnection(ProposedFeatures.all, inputStream, outputStream);
}

export function startServer(
  inputStream: NodeJS.ReadableStream = process.stdin,
  outputStream: NodeJS.WritableStream = process.stdout
): Connection {
  const connection = createServerConnection(inputStream, outputStream);
  const openDocuments = new Map<string, CachedDocument>();

  connection.onInitialize(() => ({
    capabilities: {
      completionProvider: {},
      definitionProvider: true,
      documentSymbolProvider: true,
      hoverProvider: true,
      referencesProvider: true,
      workspaceSymbolProvider: true,
      renameProvider: true,
      documentFormattingProvider: true,
      foldingRangeProvider: true,
      documentHighlightProvider: true,
      inlayHintProvider: true,
      documentLinkProvider: {
        resolveProvider: false
      },
      semanticTokensProvider: {
        legend: semanticTokensLegend,
        full: true
      },
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Full
      }
    }
  }));
  connection.onDidOpenTextDocument((params) => {
    openDocuments.set(params.textDocument.uri, buildCachedDocument(params.textDocument.text));
    publishDiagnostics();
  });
  connection.onDidChangeTextDocument((params) => {
    const nextText = params.contentChanges.at(-1)?.text;
    if (nextText === undefined) {
      return;
    }

    openDocuments.set(params.textDocument.uri, buildCachedDocument(nextText));
    publishDiagnostics();
  });
  connection.onDidCloseTextDocument((params) => {
    openDocuments.delete(params.textDocument.uri);
    connection.sendDiagnostics({
      uri: params.textDocument.uri,
      diagnostics: []
    });
    publishDiagnostics();
  });
  connection.onDocumentSymbol((params) => {
    const cached = openDocuments.get(params.textDocument.uri);
    if (cached === undefined) {
      return [];
    }

    return buildDocumentSymbols(params.textDocument.uri, cached);
  });
  connection.onWorkspaceSymbol((params) =>
    buildWorkspaceSymbols(openDocuments, params.query)
  );
  connection.onDefinition((params) =>
    findDefinition(
      openDocuments,
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
  );
  connection.onReferences((params) =>
    findReferences(
      openDocuments,
      params.textDocument.uri,
      params.position.line,
      params.position.character,
      params.context.includeDeclaration
    )
  );
  connection.onHover((params) =>
    buildHover(
      openDocuments,
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
  );
  connection.onCompletion((params) =>
    buildCompletionItems(
      openDocuments,
      params.textDocument.uri
    )
  );
  connection.languages.semanticTokens.on((params) => {
    const cached = openDocuments.get(params.textDocument.uri);
    if (cached === undefined) {
      return { data: [] };
    }
    return buildSemanticTokens(cached);
  });
  connection.onDocumentFormatting((params) => {
    const cached = openDocuments.get(params.textDocument.uri);
    if (cached === undefined) {
      return null;
    }
    return formatDocument(cached, params.options);
  });
  connection.onRenameRequest((params) =>
    buildRenameEdits(
      openDocuments,
      params.textDocument.uri,
      params.position.line,
      params.position.character,
      params.newName
    )
  );
  connection.onFoldingRanges((params) => {
    const cached = openDocuments.get(params.textDocument.uri);
    if (cached === undefined) {
      return [];
    }
    return buildFoldingRanges(cached);
  });
  connection.onDocumentLinks((params) => {
    const cached = openDocuments.get(params.textDocument.uri);
    if (cached === undefined) {
      return [];
    }
    return buildDocumentLinks(params.textDocument.uri, cached);
  });
  connection.onDocumentHighlight((params) =>
    buildDocumentHighlights(
      openDocuments.get(params.textDocument.uri),
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
  );
  connection.languages.inlayHint.on((params) =>
    buildInlayHints(openDocuments, params.textDocument.uri)
  );

  function publishDiagnostics(): void {
    for (const [uri, diagnostics] of collectDiagnosticsByUri(openDocuments).entries()) {
      connection.sendDiagnostics({
        uri,
        diagnostics: [...diagnostics]
      });
    }
  }

  connection.listen();
  return connection;
}

if (require.main === module) {
  startServer();
}
