# merls

`merls` is a language server for **Merlin-style 6502 assembly** with **coc.nvim** as the primary editor target.

## Status

The MVP LSP feature set for Merlin-style 6502 assembly is complete and published to npm as `@razdolbai/merls`. It provides core language server features and is ready to be used with editors like `coc.nvim`.

## Goals

- Provide a standalone LSP server over stdio
- Work cleanly with coc.nvim through standard language-server configuration
- support Merlin-style 6502 source structure, symbols, directives, and expressions
- Deliver useful editing features before deeper assembler integration

## Scope

### In Scope

- 6502-only Merlin-style assembly
- Parser-based diagnostics for the MVP
- Cross-file symbol resolution via `USE`, `PUT`, and `ASM`
- Core LSP features such as:
  - diagnostics
  - hover
  - completion
  - go to definition
  - find references
  - document symbols
  - workspace symbols
  - semantic tokens (syntax highlighting)

### Out of Scope

- 65816 support


## Implementation

- **runtime:** Node.js
- **language:** TypeScript
- **LSP library:** `vscode-languageserver`
- **process model:** standalone stdio server
- **development style:** TDD from the start

## Installation

Install globally via npm:

```sh
npm install -g @razdolbai/merls
```

## Development Workflow

- `npm install`: install project dependencies
- `npm run build`: compile the TypeScript sources into `dist/`
- `npm test`: build the project and run the current test suite
- `npm run dev`: run the TypeScript compiler in watch mode during bootstrap work
- `pwsh test/smoke/run-smoke.ps1`: run the headless Vim + coc.nvim smoke test (requires Vim with coc.nvim installed via vim-plug)

The packaged CLI entry point now lives at `dist/src/cli.js`.

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
- The `test/fixtures/valid/` directory contains supported 6502 Merlin-style syntax samples.
- The `test/fixtures/invalid/` directory contains unsupported 65816-only syntax samples for negative testing.
- The integration test suite covers stdio `initialize`, the CLI contract, and core LSP features.
