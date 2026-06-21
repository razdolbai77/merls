import * as path from 'path';
import * as fs from 'fs';
import { workspace, window, ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // Look for the locally built merls in the parent directory when developing
  const localServerPath = context.asAbsolutePath(
    path.join('..', 'dist', 'src', 'cli.js')
  );

  let serverOptions: ServerOptions;

  // If local build exists, use it as a NodeModule instead of an Executable
  if (fs.existsSync(localServerPath)) {
    serverOptions = {
      run: {
        module: localServerPath,
        args: ['--stdio'],
        transport: TransportKind.stdio
      },
      debug: {
        module: localServerPath,
        args: ['--stdio'],
        transport: TransportKind.stdio,
        // allow attaching debugger to the language server
        options: { execArgv: ['--nolazy', '--inspect=6009'] }
      }
    };
  } else {
    const packagedServerPath = context.asAbsolutePath(
      path.join('node_modules', '@razdolbai', 'merls', 'dist', 'src', 'cli.js')
    );

    serverOptions = {
      run: {
        module: packagedServerPath,
        args: ['--stdio'],
        transport: TransportKind.stdio
      },
      debug: {
        module: packagedServerPath,
        args: ['--stdio'],
        transport: TransportKind.stdio
      }
    };
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: '6502' },
      { scheme: 'file', pattern: '**/*.{s,S,asm}' }
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.{s,S,asm}')
    }
  };

  client = new LanguageClient(
    'pearls',
    'Pearls 6502 Language Server',
    serverOptions,
    clientOptions
  );

  client.start().catch(err => {
    window.showErrorMessage('Pearls LSP failed to start: ' + err);
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
