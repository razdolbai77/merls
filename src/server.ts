import {
  Connection,
  ProposedFeatures,
  createConnection
} from "vscode-languageserver/node";

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
  connection.onInitialize(() => ({
    capabilities: {}
  }));
  connection.listen();
  return connection;
}

if (require.main === module) {
  startServer();
}
