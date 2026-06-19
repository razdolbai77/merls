# merls

`merls` is a planned language server for **Merlin-style 6502 assembly** with **coc.nvim** as the primary editor target.

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

## Planned implementation

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

For local development from this checkout, the equivalent compiled command is `node dist/src/cli.js --stdio`.

## Roadmap

The current plan is organized into these phases:

1. bootstrap the Node/TypeScript workspace
2. define the 6502 Merlin syntax corpus and shared metadata
3. implement the lexer, parser, and document model
4. implement symbols, include handling, and diagnostics
5. add the MVP LSP features
6. package and verify coc.nvim integration

See `PLAN.md` for the full checklist.

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
- Shared 6502 opcode and Merlin directive metadata now lives in `src/asm/metadata.ts`.
- Shared token-kind and line-shape metadata now lives in `src/asm/syntax.ts`.
- The current lexer implementation now lives in `src/asm/lexer.ts` and is exercised against the shared fixture corpus.
- The current expression parser now lives in `src/asm/expression.ts` and covers numeric forms, unary modifiers, arithmetic, and indexed operand fragments.
- The current line parser now lives in `src/asm/parser.ts` and classifies equates, instructions, directives, data lines, and malformed input.
- The current document model now lives in `src/asm/document.ts` and preserves line-by-line structure while collecting malformed-line errors.
- The current symbol collector now lives in `src/asm/symbols.ts` and indexes labels, equates, and named storage/data definitions.
- The current local-label resolver now lives in `src/asm/local-labels.ts` and resolves Merlin `]local` and `:local` labels within the nearest global-label scope.
- The current workspace indexer now lives in `src/asm/workspace.ts` and follows `asm`/`put`/`use` directives across the local fixture corpus.
- The current diagnostics pass now lives in `src/asm/diagnostics.ts` and reports duplicate symbols, unresolved references, malformed lines, and unsupported 65816-only syntax.
- The current `textDocument/documentSymbol` provider is wired through `src/server.ts` and `src/lsp/document-symbols.ts`.
- The current `workspace/symbol` provider is wired through `src/server.ts` and `src/lsp/workspace-symbols.ts` over the open-document symbol set.
- The current `textDocument/definition` and `textDocument/references` handlers are wired through `src/server.ts` and `src/lsp/symbol-navigation.ts`.
- The current `textDocument/hover` handler is wired through `src/server.ts` and `src/lsp/hover.ts`.
- The current `textDocument/completion` handler is wired through `src/server.ts` and `src/lsp/completion.ts`.
- The current `textDocument/publishDiagnostics` path is wired through `src/server.ts` and `src/lsp/diagnostics.ts`, with full-document sync on open and change so coc.nvim receives live parser and resolver errors.
- The packaged CLI entrypoint now lives in `src/cli.ts`, compiles to `dist/src/cli.js`, and supports the explicit stdio contract `merls --stdio`.
- The checked-in coc.nvim example targets the globally installed `merls` command and includes root detection for `.git`.
- The positive fixture corpus now starts with transcribed Merlin32 material under `test/fixtures/valid/`.
- Positive fixtures should cover supported 6502 Merlin-style syntax.
- The negative fixture corpus now starts with explicit 65816-only samples under `test/fixtures/invalid/`.
- Negative fixtures should explicitly cover unsupported 65816 syntax.
- The current bootstrap test harness is intentionally minimal and runs against compiled output to avoid depending on editor or browser tooling.
- The current integration coverage reaches through stdio `initialize`, the packaged CLI contract, completion, hover, symbol navigation, and diagnostics publication.
