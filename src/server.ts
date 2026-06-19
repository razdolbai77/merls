import {
  Connection,
  ProposedFeatures,
  TextDocumentSyncKind,
  createConnection
} from "vscode-languageserver/node";

import { buildDocumentSymbols } from "./lsp/document-symbols";

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
      documentSymbolProvider: true,
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
  connection.listen();
  return connection;
}

if (require.main === module) {
  startServer();
}
