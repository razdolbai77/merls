import {
  Connection,
  ProposedFeatures,
  TextDocumentSyncKind,
  createConnection,
  FileChangeType,
  type PublishDiagnosticsParams
} from "vscode-languageserver/node";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

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
import { buildCodeLenses } from "./lsp/code-lens";
import { buildSelectionRanges } from "./lsp/selection-range";
import { indexWorkspace } from "./asm/workspace";
import { uriToFilePath } from "./lsp/uri";

const completionTriggerCharacters = "]:_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");

export type DiagnosticsSender = Pick<Connection, "sendDiagnostics">;

export function sendDiagnosticsSafely(
  sender: DiagnosticsSender,
  params: PublishDiagnosticsParams
): void {
  // Diagnostics are best-effort notifications; a disposed or disconnected
  // client must not surface an unhandled promise rejection.
  sender.sendDiagnostics(params).catch(() => undefined);
}
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
  const diskCache = new Map<string, CachedDocument>();

  let cachedIndexedDocuments: Map<string, CachedDocument> | null = null;
  // Reused until workspace or open-document changes invalidate it.

  connection.onInitialize(() => ({
    capabilities: {
      completionProvider: {
        triggerCharacters: completionTriggerCharacters
      },
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
    cachedIndexedDocuments = null;
    openDocuments.set(params.textDocument.uri, buildCachedDocument(params.textDocument.text));
    publishDiagnostics();
  });
  connection.onDidChangeTextDocument((params) => {
    const nextText = params.contentChanges.at(-1)?.text;
    if (nextText === undefined) {
      return;
    }

    cachedIndexedDocuments = null;
    openDocuments.set(params.textDocument.uri, buildCachedDocument(nextText));
    publishDiagnostics();
  });
  connection.onDidCloseTextDocument((params) => {
    cachedIndexedDocuments = null;
    openDocuments.delete(params.textDocument.uri);
    evictUnreachableDiskCache();
    sendDiagnosticsSafely(connection, {
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

  function getIndexedDocuments(): Map<string, CachedDocument> {
    if (cachedIndexedDocuments !== null) {
      return cachedIndexedDocuments;
    }
    const overrides = new Map<string, CachedDocument>();
    
    // Normalize paths to prevent duplicate entries (e.g. file:///c:/ vs file:///C:/)
    const addedPaths = new Set<string>();
    for (const [uri, doc] of openDocuments.entries()) {
      const filePath = uriToFilePath(uri);
      if (uri.startsWith("file://")) {
        addedPaths.add(filePath.toLowerCase());
      }
      overrides.set(filePath, doc);
    }

    const combined = new Map<string, CachedDocument>(openDocuments);
    for (const [filePath, doc] of diskCache.entries()) {
      if (addedPaths.has(filePath.toLowerCase())) {
        continue;
      }
      combined.set(pathToFileURL(filePath).href, doc);
      addedPaths.add(filePath.toLowerCase());
    }
    for (const uri of openDocuments.keys()) {
      const filePath = uriToFilePath(uri);
      const workspace = indexWorkspace(filePath, diskCache, overrides);
      for (const [docPath, cached] of workspace.documents.entries()) {
        const normalizedDocPath = docPath.toLowerCase();
        if (!addedPaths.has(normalizedDocPath)) {
          const docUri = docPath.startsWith("untitled:") 
            ? docPath 
            : pathToFileURL(docPath).href;
          combined.set(docUri, cached);
          addedPaths.add(normalizedDocPath);
        }
      }
    }
    cachedIndexedDocuments = combined;
    return combined;
  }

  connection.onWorkspaceSymbol((params) =>
    buildWorkspaceSymbols(getIndexedDocuments(), params.query)
  );
  connection.onDefinition((params) =>
    findDefinition(
      getIndexedDocuments(),
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
  );
  connection.onReferences((params) =>
    findReferences(
      getIndexedDocuments(),
      params.textDocument.uri,
      params.position.line,
      params.position.character,
      params.context.includeDeclaration
    )
  );
  connection.onHover((params) =>
    buildHover(
      getIndexedDocuments(),
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
  );
  connection.onCompletion((params) =>
    buildCompletionItems(
      getIndexedDocuments(),
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
  );
  connection.languages.semanticTokens.on((params) => {
    const cached = openDocuments.get(params.textDocument.uri);
    if (cached === undefined) {
      return { data: [] };
    }
    return buildSemanticTokens(cached, getIndexedDocuments());
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
      getIndexedDocuments(),
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
      openDocuments,
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
  );
  connection.languages.inlayHint.on((params) =>
    buildInlayHints(getIndexedDocuments(), params.textDocument.uri)
  );
  connection.onSignatureHelp((params) =>
    buildSignatureHelp(
      getIndexedDocuments(),
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
  );

  connection.languages.callHierarchy.onPrepare((params) =>
    prepareCallHierarchy(getIndexedDocuments(), params.textDocument.uri, params.position.line, params.position.character)
  );
  connection.languages.callHierarchy.onIncomingCalls((params) =>
    provideCallHierarchyIncomingCalls(getIndexedDocuments(), params.item)
  );
  connection.languages.callHierarchy.onOutgoingCalls((params) =>
    provideCallHierarchyOutgoingCalls(getIndexedDocuments(), params.item)
  );

  connection.onCodeLens((params) =>
    buildCodeLenses(getIndexedDocuments(), params.textDocument.uri)
  );
  connection.onSelectionRanges((params) =>
    buildSelectionRanges(getIndexedDocuments(), params.textDocument.uri, params.positions)
  );


  function evictUnreachableDiskCache(): void {
    const overrides = new Map<string, CachedDocument>();
    for (const [uri, doc] of openDocuments.entries()) {
      overrides.set(uriToFilePath(uri), doc);
    }

    const reachablePaths = new Set<string>();
    for (const entryPath of overrides.keys()) {
      const workspace = indexWorkspace(entryPath, diskCache, overrides);
      for (const docPath of workspace.documents.keys()) {
        reachablePaths.add(docPath.toLowerCase());
      }
    }

    for (const filePath of [...diskCache.keys()]) {
      if (!reachablePaths.has(filePath.toLowerCase())) {
        diskCache.delete(filePath);
      }
    }
  }
  connection.onDidChangeWatchedFiles(async (params) => {
    cachedIndexedDocuments = null;
    await Promise.all(params.changes.map(async (change) => {
      const filePath = uriToFilePath(change.uri);
      if (change.type === FileChangeType.Deleted) {
        diskCache.delete(filePath);
      } else {
        try {
          const source = await fs.promises.readFile(filePath, "utf8");
          diskCache.set(filePath, buildCachedDocument(source));
        } catch {
          diskCache.delete(filePath);
        }
      }
    }));
    evictUnreachableDiskCache();
    cachedIndexedDocuments = null;
    publishDiagnostics();
  });

  function publishDiagnostics(): void {
    for (const [uri, diagnostics] of collectDiagnosticsByUri(openDocuments, getIndexedDocuments()).entries()) {
      sendDiagnosticsSafely(connection, {
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
