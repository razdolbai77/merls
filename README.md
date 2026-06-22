# merls

`merls` is a powerful Language Server for **Merlin32-style 6502 assembly**. It provides a rich set of intelligent IDE features and includes a fully-fledged **Visual Studio Code extension** as well as a standalone server published to npm (e.g., for **coc.nvim**).

## Status

The LSP feature set for Merlin32-style 6502 assembly is comprehensive and fully implemented. The repository now includes:
1. A standalone Language Server (`@razdolbai/merls`) published to npm for use with Neovim/Vim.
2. A bundled VS Code Extension (in the `vscode/` directory) for a plug-and-play graphical editor experience.

## Goals

- Provide a standalone LSP server over stdio
- Provide a seamless out-of-the-box experience in VS Code via the native extension
- Work cleanly with coc.nvim through standard language-server configuration
- Support Merlin32-style 6502 source structure, symbols, directives, and expressions
- Deliver useful editing features before deeper assembler integration

## Scope

### In Scope

- 6502-only Merlin32-style assembly
- Parser-based diagnostics
- Cross-file symbol resolution via `USE`, `PUT`, and `ASM`
- Extensive LSP features including:
  - diagnostics
  - hover
  - completion
  - go to definition
  - find references
  - document symbols
  - workspace symbols
  - semantic tokens (syntax highlighting)
  - rename
  - formatting (document, range, on-type)
  - folding ranges
  - document highlights
  - inlay hints
  - signature help
  - call hierarchy
  - code actions
  - code lens
  - document links
  - selection ranges

### Out of Scope

- 65816 support


## Implementation

- **runtime:** Node.js
- **language:** TypeScript
- **LSP library:** `vscode-languageserver`
- **process model:** standalone stdio server
- **development style:** TDD from the start

## Installation

### VS Code (Primary)
The VS Code extension lives in the `vscode/` folder. It bundles the Language Server automatically.
To package and install it locally:
```sh
cd vscode
npm install
npm run compile
npx vsce package
code --install-extension pearls-1.0.0.vsix
```

Once installed, the extension also contributes `Pearls: Compile Current File with Merlin32` and `Pearls: Assemble Project with Merlin32` commands. The project command uses `pearls.merlin32ProjectEntryFile` to choose a link script or entry source, then launches `merlin32 <macro-folder> <entry-file>` in an integrated terminal.

### Standalone Server (coc.nvim / Neovim)
If you are using Vim/Neovim or another LSP client, you can install the standalone server globally via npm:

```sh
npm install -g @razdolbai/merls
```

## Development Workflow

- `npm install`: install project dependencies
- `npm run build`: compile the TypeScript sources into `dist/`
- `npm test`: build the project and run the current test suite
- `npm run dev`: run the TypeScript compiler in watch mode during bootstrap work
- `pwsh test/smoke/run-smoke.ps1`: run the headless Vim + coc.nvim smoke test (requires Vim with coc.nvim installed via vim-plug)
- `cd vscode && npm test`: compile and run the VS Code extension unit tests

The packaged CLI entry point now lives at `dist/src/cli.js`. For VS Code specific development, refer to `vscode/DEVELOPMENT.md`.

## CLI Contract

The supported stdio launch contract is `merls --stdio`.

## coc.nvim Target

The intended integration model is a standard `languageserver` entry in `coc-settings.json` that launches `merls` over stdio.

If you installed `merls` globally via npm, the `languageserver` shape is:

```json
{
  "semanticTokens.enable": true,
  "languageserver": {
    "merls": {
      "command": "merls",
      "args": [
        "--stdio"
      ],
      "rootPatterns": [
        ".git"
      ],
      "filetypes": [
        "6502"
      ]
    }
  }
}
```

To enable semantic tokens for syntax highlighting, ensure `"semanticTokens.enable": true` is set in your `coc-settings.json` and that your Vim buffer is set to the matching filetype (e.g. `set filetype=6502`).

An example configuration lives in `examples/coc-settings.json`.

## Development Notes

- TDD is mandatory for implementation work in this repository.
- Core syntax, parsing, and document model logic are located in `src/asm/`.
- LSP handlers (hover, completion, diagnostics, etc.) are located in `src/lsp/`.
- The CLI entry point lives in `src/cli.ts` and compiles to `dist/src/cli.js`.
- The VS Code extension contributes `Pearls: Compile Current File with Merlin32` and `Pearls: Assemble Project with Merlin32` commands and exposes `pearls.merlin32Executable`, `pearls.compileArgs`, `pearls.merlin32MacroFolder`, and `pearls.merlin32ProjectEntryFile` settings for assembler invocation.
- The `test/fixtures/valid/` directory contains supported 6502 Merlin32-style syntax samples, including dedicated macro-coverage fixtures for nested calls, zero-argument macros, local labels, and conditional assembly forms.
- The `test/fixtures/invalid/` directory contains unsupported 65816-only syntax samples for negative testing plus negative macro fixtures such as macro-generated unresolved references.
- Parser tests now explicitly lock down current macro-call parsing and the existing `mac`/`eom`/`<<<` line behavior before macro-structure refactors.
- The parser now exposes first-class macro definition regions, including body lines, closing directives, positional parameter placeholders, nested macro calls, symbol references, and macro-local label definitions/references, via `src/asm/parser.ts`.
- The document model now exposes explicit macro definition and macro call structures, including structured macro body usage metadata for parameter references, nested calls, symbol references, and macro-local labels, via `src/asm/document.ts`.
- The macro index now lives in `src/asm/macros.ts` and collects per-document and per-workspace macro definitions, body ranges, positional arity, referenced symbols, nested macro calls, and macro-local label usage.
- The symbol index in `src/asm/symbols.ts` now uses one shared record shape for labels, equates, data definitions, and macros, including token locations and attached macro-definition metadata for macro symbols.
- Signature help in `src/lsp/signature-help.ts` now derives macro parameter counts from the parsed macro index rather than rescanning macro body text with regexes.
- Signature-help coverage now explicitly includes zero-argument macros, multi-digit positional parameters, nested expressions, and comma handling that only advances the active parameter at top-level argument boundaries.
- Diagnostics in `src/asm/diagnostics.ts` now emit macro-specific failures for unresolved macro calls, duplicate macro definitions, missing `eom`/`<<<` terminators, illegal nested macro definitions, and straightforward arity mismatches.
- Macro diagnostics now carry stable token-based character ranges for macro-definition and macro-call failures, and the LSP diagnostic bridge preserves those narrower spans instead of always highlighting whole lines.
- The initial parameter-substitution model now lives in `src/asm/substitution.ts`, mapping macro call arguments onto the `]n` placeholders they satisfy inside parsed macro bodies and collecting symbol references from each supplied argument expression.
- The integration test suite covers stdio `initialize`, the CLI contract, and core LSP features.
