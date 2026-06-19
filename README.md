# merls

`merls` is a planned language server for **Merlin-style 6502 assembly** with **coc.nvim** as the primary editor target.

## Status

This repository now has an initial Node.js and TypeScript workspace scaffold plus a minimal stdio LSP entrypoint in `src/server.ts`. The language server implementation itself is still at the bootstrap stage, and the remaining work is tracked in `PLAN.md`.

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

## Development workflow

- `npm install`: install project dependencies
- `npm run build`: compile the TypeScript sources into `dist/`
- `npm test`: build the project and run the current test suite
- `npm run dev`: run the TypeScript compiler in watch mode during bootstrap work

The compiled server entrypoint currently lives at `dist/src/server.js`.

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

An initial example lives in `examples/coc-settings.json`. The current bootstrap flow is:

1. run `npm install`
2. run `npm run build`
3. point coc.nvim at `dist/src/server.js`

The bundled example uses `node` plus an absolute path to the compiled server and currently targets the `asm` filetype.

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
- The positive fixture corpus now starts with transcribed Merlin32 material under `test/fixtures/valid/`.
- Positive fixtures should cover supported 6502 Merlin-style syntax.
- The negative fixture corpus now starts with explicit 65816-only samples under `test/fixtures/invalid/`.
- Negative fixtures should explicitly cover unsupported 65816 syntax.
- The current bootstrap test harness is intentionally minimal and runs against compiled output to avoid depending on editor or browser tooling.
- The current integration coverage reaches through the stdio `initialize` handshake.
