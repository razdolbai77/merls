import {
  Connection,
  ProposedFeatures,
  TextDocumentSyncKind,
  createConnection,
  FileChangeType
} from "vscode-languageserver/node";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { buildCachedDocument, type CachedDocument } from "./asm/document";
import { buildDocumentSymbols } from "./lsp/document-symbols";
import { buildCompletionItems } from "./lsp/completion";
import { collectDiagnosticsByUri } from "./lsp/diagnostics";
import { buildHover } from "./lsp/hover";
import { findDefinition, findReferences } from "./lsp/symbol-navigation";
import { buildWorkspaceSymbols } from "./lsp/workspace-symbols";
import { buildSemanticTokens, semanticTokensLegend } from "./lsp/semantic-tokens";
import { formatDocument, formatRange, formatOnType } from "./lsp/formatting";
import { buildRenameEdits } from "./lsp/rename";
import { buildFoldingRanges } from "./lsp/folding";
import { buildDocumentLinks } from "./lsp/document-links";
import { buildDocumentHighlights } from "./lsp/document-highlights";
import { buildInlayHints } from "./lsp/inlay-hints";
import { buildSignatureHelp } from "./lsp/signature-help";
import { prepareCallHierarchy, provideCallHierarchyIncomingCalls, provideCallHierarchyOutgoingCalls } from "./lsp/call-hierarchy";
import { provideCodeActions } from "./lsp/code-actions";
import { buildCodeLenses } from "./lsp/code-lens";
import { buildSelectionRanges } from "./lsp/selection-range";

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
  const watchedDocuments = new Map<string, CachedDocument>();

  function getAllDocuments(): Map<string, CachedDocument> {
    const all = new Map(watchedDocuments);
    for (const [uri, doc] of openDocuments.entries()) {
      all.set(uri, doc);
    }
    return all;
  }

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
      documentRangeFormattingProvider: true,
      documentOnTypeFormattingProvider: {
        firstTriggerCharacter: "\n"
      },
      foldingRangeProvider: true,
      documentHighlightProvider: true,
      inlayHintProvider: true,
      signatureHelpProvider: {
        triggerCharacters: [" ", ","]
      },
      callHierarchyProvider: true,
      codeActionProvider: true,
      selectionRangeProvider: true,
      codeLensProvider: {
        resolveProvider: false
      },
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
    void connection.sendDiagnostics({
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
    buildWorkspaceSymbols(getAllDocuments(), params.query)
  );
  connection.onDefinition((params) =>
    findDefinition(
      getAllDocuments(),
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
  );
  connection.onReferences((params) =>
    findReferences(
      getAllDocuments(),
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
    return cached ? formatDocument(cached, params.options) : null;
  });
  connection.onDocumentRangeFormatting((params) => {
    const cached = openDocuments.get(params.textDocument.uri);
    return cached ? formatRange(cached, params.options, params.range) : null;
  });
  connection.onDocumentOnTypeFormatting((params) => {
    const cached = openDocuments.get(params.textDocument.uri);
    return cached ? formatOnType(cached, params.options, params.position, params.ch) : null;
  });
  connection.onRenameRequest((params) =>
    buildRenameEdits(
      getAllDocuments(),
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
    buildInlayHints(getAllDocuments(), params.textDocument.uri)
  );
  connection.onSignatureHelp((params) =>
    buildSignatureHelp(
      getAllDocuments(),
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
  );

  connection.languages.callHierarchy.onPrepare((params) =>
    prepareCallHierarchy(openDocuments, params.textDocument.uri, params.position.line, params.position.character)
  );
  connection.languages.callHierarchy.onIncomingCalls((params) =>
    provideCallHierarchyIncomingCalls(openDocuments, params.item)
  );
  connection.languages.callHierarchy.onOutgoingCalls((params) =>
    provideCallHierarchyOutgoingCalls(getAllDocuments(), params.item)
  );

  connection.onCodeAction((params) =>
    provideCodeActions(getAllDocuments(), params.textDocument.uri, params.context.diagnostics)
  );
  connection.onCodeLens((params) =>
    buildCodeLenses(getAllDocuments(), params.textDocument.uri)
  );
  connection.onSelectionRanges((params) =>
    buildSelectionRanges(getAllDocuments(), params.textDocument.uri, params.positions)
  );

  connection.onDidChangeWatchedFiles((params) => {
    for (const change of params.changes) {
      if (change.type === FileChangeType.Deleted) {
        watchedDocuments.delete(change.uri);
      } else {
        try {
          let filePath = change.uri;
          if (filePath.startsWith("file://")) {
            filePath = fileURLToPath(filePath);
          }
          const source = fs.readFileSync(filePath, "utf8");
          watchedDocuments.set(change.uri, buildCachedDocument(source));
        } catch {
          watchedDocuments.delete(change.uri);
        }
      }
    }
    publishDiagnostics();
  });

  function publishDiagnostics(): void {
    for (const [uri, diagnostics] of collectDiagnosticsByUri(openDocuments, getAllDocuments()).entries()) {
      void connection.sendDiagnostics({
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
