# merls

`merls` is a language server for **Merlin-style 6502 assembly** with **coc.nvim** as the primary editor target.

## Status

The MVP LSP feature set for Merlin-style 6502 assembly is complete and published to npm as `@razdolbai/merls`. It provides core language server features and is ready to be used with editors like `coc.nvim`. All planned tasks in `PLAN.md` have been fulfilled.

## Goals

- provide a standalone LSP server over stdio
- work cleanly with coc.nvim through standard language-server configuration
- support Merlin-style 6502 source structure, symbols, directives, and expressions
- deliver useful editing features before deeper assembler integration

## Scope

### In scope

- 6502-only Merlin-style assembly
- parser-based diagnostics for the MVP
- core LSP features such as:
  - diagnostics
  - hover
  - completion
  - go to definition
  - find references
  - document symbols
  - workspace symbols

### Out of scope

- 65816 support
- assembler-backed diagnostics in the first implementation pass
- coc.nvim-specific plugin code for the MVP

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

## Development workflow

- `npm install`: install project dependencies
- `npm run build`: compile the TypeScript sources into `dist/`
- `npm test`: build the project and run the current test suite
- `npm run dev`: run the TypeScript compiler in watch mode during bootstrap work
- `pwsh test/smoke/run-smoke.ps1`: run the headless Vim + coc.nvim smoke test (requires Vim with coc.nvim installed via vim-plug)

The packaged CLI entrypoint now lives at `dist/src/cli.js`.

## CLI contract

The supported stdio launch contract is `merls --stdio`.


## coc.nvim target

The intended integration model is a standard `languageserver` entry in `coc-settings.json` that launches `merls` over stdio.

If you installed `merls` globally via npm, the `languageserver` shape is:

```json
{
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
        "asm"
      ]
    }
  }
}
```

An example configuration lives in `examples/coc-settings.json`.

## Development notes

- TDD is mandatory for implementation work in this repository.
- Core syntax, parsing, and document model logic is located in `src/asm/`.
- LSP handlers (hover, completion, diagnostics, etc.) are located in `src/lsp/`.
- The CLI entrypoint lives in `src/cli.ts` and compiles to `dist/src/cli.js`.
- The `test/fixtures/valid/` directory contains supported 6502 Merlin-style syntax samples.
- The `test/fixtures/invalid/` directory contains unsupported 65816-only syntax samples for negative testing.
- The integration test suite covers stdio `initialize`, the CLI contract, and core LSP features.
