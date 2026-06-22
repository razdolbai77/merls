# Pearls Development Guide

This is the official Visual Studio Code extension for the `merls` Merlin32-style 6502 assembly language server. It brings standard language features like syntax highlighting, hover documentation, definition navigation, and semantic tokens directly to VS Code.

## Development

The extension serves as an LSP Client that launches the `merls` language server.

### Building and Testing
1. Inside the `vscode/` folder, install the extension dependencies:
   ```bash
   npm install
   ```
2. Compile the TypeScript code:
   ```bash
   npm run compile
   ```
   *(Or run `npm run watch` to compile on every file change).*
3. Run the extension unit tests:
   ```bash
   npm test
   ```
4. Open the `vscode/` folder in VS Code, and press **F5** to start a new VS Code window (Extension Development Host) with the extension loaded.

> **Note**: During development, the extension is wired to look for `../dist/src/cli.js`. Ensure you have built the main `merls` project at the repository root first (`npm run build`).

The extension now also contributes `Pearls: Compile Current File with Merlin32` and `Pearls: Assemble Project with Merlin32`, which launch `merlin32 <macro-folder> <source-or-entry-file>` in the integrated terminal. Use the `pearls.merlin32Executable`, `pearls.compileArgs`, `pearls.merlin32MacroFolder`, and `pearls.merlin32ProjectEntryFile` settings to adjust the command line during development.

## Packaging

To package the extension into a standalone `.vsix` file that can be distributed:

1. Inside the `vscode/` directory, use the `vsce` packaging tool:
   ```bash
   npx @vscode/vsce package
   ```
2. This command will compile the extension and generate a file named `pearls-a.b.c.vsix` in the same directory. The `.vscodeignore` file automatically ensures development and source files aren't included in this bundle.

## Installing Locally

If you just want to install the packaged extension to your personal VS Code environment without publishing:

1. Create the `.vsix` package as shown above.
2. Install it via the command line:
   ```bash
   code --install-extension pearls-1.0.0.vsix
   ```
   *Alternatively, in VS Code, open the Extensions view, click the "..." menu at the top right, and select **Install from VSIX...**.*

## Publishing

To publish the extension to the Visual Studio Marketplace so anyone can download it:

1. Ensure the `"publisher"` name in `package.json` matches your registered publisher ID on the VS Marketplace.
2. Obtain a Personal Access Token (PAT) from Azure DevOps.
3. Login using `vsce`:
   ```bash
   npx @vscode/vsce login <publisher-name>
   ```
4. Publish the extension:
   ```bash
   npx @vscode/vsce publish
   ```
*(For a full guide on creating a publisher account and retrieving a PAT, see the [VS Code Publishing Extension Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)).*
