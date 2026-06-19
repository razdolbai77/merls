import {
  Connection,
  ProposedFeatures,
  TextDocumentSyncKind,
  createConnection
} from "vscode-languageserver/node";

import { buildDocumentSymbols } from "./lsp/document-symbols";
import { buildCompletionItems } from "./lsp/completion";
import { collectDiagnosticsByUri } from "./lsp/diagnostics";
import { buildHover } from "./lsp/hover";
import { findDefinition, findReferences } from "./lsp/symbol-navigation";
import { buildWorkspaceSymbols } from "./lsp/workspace-symbols";
import { buildSemanticTokens, semanticTokensLegend } from "./lsp/semantic-tokens";

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
  const openDocuments = new Map<string, string>();

  connection.onInitialize(() => ({
    capabilities: {
      completionProvider: {},
      definitionProvider: true,
      documentSymbolProvider: true,
      hoverProvider: true,
      referencesProvider: true,
      workspaceSymbolProvider: true,
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
    openDocuments.set(params.textDocument.uri, params.textDocument.text);
    publishDiagnostics();
  });
  connection.onDidChangeTextDocument((params) => {
    const nextText = params.contentChanges.at(-1)?.text;
    if (nextText === undefined) {
      return;
    }

    openDocuments.set(params.textDocument.uri, nextText);
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
    const source = openDocuments.get(params.textDocument.uri);
    if (source === undefined) {
      return [];
    }

    return buildDocumentSymbols(params.textDocument.uri, source);
  });
  connection.onWorkspaceSymbol((params) =>
    buildWorkspaceSymbols(openDocuments, params.query)
  );
  connection.onDefinition((params) =>
    findDefinition(
      openDocuments,
      params.textDocument.uri,
      params.position.line
    )
  );
  connection.onReferences((params) =>
    findReferences(
      openDocuments,
      params.textDocument.uri,
      params.position.line,
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
      params.textDocument.uri,
      params.position.line
    )
  );
  connection.languages.semanticTokens.on((params) => {
    const source = openDocuments.get(params.textDocument.uri);
    if (source === undefined) {
      return { data: [] };
    }
    return buildSemanticTokens(source);
  });

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
