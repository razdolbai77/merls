import {
  Connection,
  ProposedFeatures,
  TextDocumentSyncKind,
  createConnection
} from "vscode-languageserver/node";

import { buildDocumentSymbols } from "./lsp/document-symbols";
import { buildCompletionItems } from "./lsp/completion";
import { buildHover } from "./lsp/hover";
import { findDefinition, findReferences } from "./lsp/symbol-navigation";
import { buildWorkspaceSymbols } from "./lsp/workspace-symbols";

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
      documentSymbolProvider: true,
      hoverProvider: true,
      workspaceSymbolProvider: true,
      textDocumentSync: TextDocumentSyncKind.None
    }
  }));
  connection.onDidOpenTextDocument((params) => {
    openDocuments.set(params.textDocument.uri, params.textDocument.text);
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
  connection.listen();
  return connection;
}

if (require.main === module) {
  startServer();
}
