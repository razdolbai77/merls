import fs from "node:fs";
import path from "node:path";
import { commands, workspace, window, Uri, type ExtensionContext } from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind
} from "vscode-languageclient/node";
import {
  buildCompileCommand,
  getCompileWorkingDirectory,
  getMacroFolderPath,
  getProjectEntryFilePath
} from "./compile";
import { applyPearlsEditorOptions, pearlsLanguageId } from "./editor-options";
let client: LanguageClient;
const compileCurrentFileCommand = "pearls.compileCurrentFile";
const compileProjectCommand = "pearls.compileProject";

export function activate(context: ExtensionContext) {
  // Look for the locally built merls in the parent directory when developing
  const localServerPath = context.asAbsolutePath(
    path.join("..", "dist", "src", "cli.js")
  );

  let serverOptions: ServerOptions;

  // If local build exists, use it as a NodeModule instead of an Executable
  if (fs.existsSync(localServerPath)) {
    serverOptions = {
      run: {
        module: localServerPath,
        args: ["--stdio"],
        transport: TransportKind.stdio
      },
      debug: {
        module: localServerPath,
        args: ["--stdio"],
        transport: TransportKind.stdio
      }
    };
  } else {
    const packagedServerPath = context.asAbsolutePath(
      path.join("node_modules", "@razdolbai", "merls", "dist", "src", "cli.js")
    );

    serverOptions = {
      run: {
        module: packagedServerPath,
        args: ["--stdio"],
        transport: TransportKind.stdio
      },
      debug: {
        module: packagedServerPath,
        args: ["--stdio"],
        transport: TransportKind.stdio
      }
    };
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: pearlsLanguageId },
      { scheme: "untitled", language: pearlsLanguageId },
      { scheme: "file", pattern: "**/*.{s,S,asm}" }
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.{s,S,asm}")
    }
  };

  client = new LanguageClient(
    "pearls",
    "Pearls 6502 Language Server",
    serverOptions,
    clientOptions
  );

  client.start().catch((err) => {
    window.showErrorMessage(`Pearls LSP failed to start: ${err}`);
  });

  for (const editor of window.visibleTextEditors) {
    applyPearlsEditorOptions(editor);
  }

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor) => {
      if (editor !== undefined) {
        applyPearlsEditorOptions(editor);
      }
    })
  );

  context.subscriptions.push(
    window.onDidChangeVisibleTextEditors((editors) => {
      for (const editor of editors) {
        applyPearlsEditorOptions(editor);
      }
    })
  );

  context.subscriptions.push(
    commands.registerCommand(compileCurrentFileCommand, async (uri?: Uri) => {
      await compileCurrentFile(uri);
    })
  );

  context.subscriptions.push(
    commands.registerCommand(compileProjectCommand, async (uri?: Uri) => {
      await compileProject(uri);
    })
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

async function compileCurrentFile(uri?: Uri): Promise<void> {
  const document =
    uri !== undefined
      ? await workspace.openTextDocument(uri)
      : window.activeTextEditor?.document;

  if (document === undefined) {
    void window.showErrorMessage("Pearls: open a Merlin32 source file before compiling.");
    return;
  }

  if (document.isUntitled) {
    void window.showErrorMessage("Pearls: save the current file before compiling with merlin32.");
    return;
  }

  if (document.isDirty) {
    const saved = await document.save();
    if (!saved) {
      void window.showErrorMessage("Pearls: the current file must be saved before compiling.");
      return;
    }
  }

  const configuration = workspace.getConfiguration("pearls", document.uri);
  const assemblerPath = configuration.get<string>("merlin32Executable", "merlin32");
  const extraArgs = configuration.get<string[]>("compileArgs", []);
  const configuredMacroFolderPath =
    configuration.get<string>("merlin32MacroFolder")?.trim() || undefined;
  const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
  const command = buildCompileCommand({
    assemblerPath,
    extraArgs,
    macroFolderPath: getMacroFolderPath(document.uri.fsPath, configuredMacroFolderPath),
    sourcePath: document.uri.fsPath,
    isWindows: process.platform === "win32"
  });

  const terminal = window.createTerminal({
    name: "Pearls Merlin32",
    cwd: getCompileWorkingDirectory(document.uri.fsPath, workspaceFolder?.uri.fsPath)
  });

  terminal.show(true);
  terminal.sendText(command, true);
}

async function compileProject(uri?: Uri): Promise<void> {
  const targetUri = uri ?? window.activeTextEditor?.document.uri;
  const workspaceFolder =
    targetUri !== undefined ? workspace.getWorkspaceFolder(targetUri) : undefined;

  if (workspaceFolder === undefined) {
    void window.showErrorMessage(
      "Pearls: open a file inside a workspace and configure pearls.merlin32ProjectEntryFile before assembling the project."
    );
    return;
  }

  const configuration = workspace.getConfiguration("pearls", workspaceFolder.uri);
  const configuredEntryFile =
    configuration.get<string>("merlin32ProjectEntryFile")?.trim() ?? "";

  if (configuredEntryFile.length === 0) {
    void window.showErrorMessage(
      "Pearls: set pearls.merlin32ProjectEntryFile for this workspace before assembling the project."
    );
    return;
  }

  const entryFilePath = getProjectEntryFilePath(
    workspaceFolder.uri.fsPath,
    configuredEntryFile
  );

  try {
    await workspace.fs.stat(Uri.file(entryFilePath));
  } catch {
    void window.showErrorMessage(
      `Pearls: configured project entry file was not found: ${entryFilePath}`
    );
    return;
  }

  const document = await workspace.openTextDocument(entryFilePath);

  if (document.isDirty) {
    const saved = await document.save();
    if (!saved) {
      void window.showErrorMessage("Pearls: the project entry file must be saved before compiling.");
      return;
    }
  }

  const assemblerPath = configuration.get<string>("merlin32Executable", "merlin32");
  const extraArgs = configuration.get<string[]>("compileArgs", []);
  const configuredMacroFolderPath =
    configuration.get<string>("merlin32MacroFolder")?.trim() || undefined;
  const command = buildCompileCommand({
    assemblerPath,
    extraArgs,
    macroFolderPath: getMacroFolderPath(document.uri.fsPath, configuredMacroFolderPath),
    sourcePath: document.uri.fsPath,
    isWindows: process.platform === "win32"
  });

  const terminal = window.createTerminal({
    name: "Pearls Merlin32",
    cwd: getCompileWorkingDirectory(document.uri.fsPath, workspaceFolder.uri.fsPath)
  });

  terminal.show(true);
  terminal.sendText(command, true);
}
