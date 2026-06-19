# Repository Guidelines

## Project Structure & Module Organization

This repository is in the bootstrap stage. Today, the main documents are `README.md` for scope and `PLAN.md` for the implementation checklist. The planned runtime is Node.js with TypeScript and `vscode-languageserver`.

When the workspace is scaffolded, keep code under `src/`, tests under `test/`, and editor integration examples under `examples/` such as `examples/coc-settings.json`. Store parser fixtures in a dedicated test-fixture area and separate valid 6502 cases from invalid 65816 cases.

The current bootstrap server entrypoint is `src/server.ts`, and the packaged CLI entrypoint is `src/cli.ts`, which compiles to `dist/src/cli.js`.
The repository now includes `examples/coc-settings.json` as the baseline coc.nvim launch example, targeting `dist/src/cli.js --stdio` with `.git` and `package.json` root markers.
The initial positive fixture corpus now lives under `test/fixtures/valid/` and is transcribed from upstream Merlin32 sources.
The initial negative fixture corpus now lives under `test/fixtures/invalid/` and captures unsupported 65816-only syntax.
Shared 6502 opcode and Merlin directive metadata now lives under `src/asm/metadata.ts`.
Shared token-kind and line-shape metadata now lives under `src/asm/syntax.ts`.
The current lexer implementation now lives under `src/asm/lexer.ts` and is covered by fixture-driven unit tests.
The current expression parser now lives under `src/asm/expression.ts` and is covered by unit tests for numeric forms, modifiers, arithmetic, and indexed operands.
The current line parser now lives under `src/asm/parser.ts` and classifies equates, instructions, directives, data lines, and malformed input.
The current document model now lives under `src/asm/document.ts` and preserves line-by-line structure while collecting malformed-line errors.
The current symbol collector now lives under `src/asm/symbols.ts` and indexes labels, equates, and named storage/data definitions.
The current local-label resolver now lives under `src/asm/local-labels.ts` and resolves Merlin `]local` and `:local` labels within the nearest global-label scope.
The current workspace indexer now lives under `src/asm/workspace.ts` and follows `asm`/`put`/`use` directives across the local fixture corpus.
The current diagnostics pass now lives under `src/asm/diagnostics.ts` and reports duplicate symbols, unresolved references, malformed lines, and unsupported 65816-only syntax.
The current `textDocument/documentSymbol` provider is wired through `src/server.ts` and `src/lsp/document-symbols.ts`.
The current `workspace/symbol` provider is wired through `src/server.ts` and `src/lsp/workspace-symbols.ts` over the open-document symbol set.
The current `textDocument/definition` and `textDocument/references` handlers are wired through `src/server.ts` and `src/lsp/symbol-navigation.ts`.
The current `textDocument/hover` handler is wired through `src/server.ts` and `src/lsp/hover.ts`.
The current `textDocument/completion` handler is wired through `src/server.ts` and `src/lsp/completion.ts`.
The current `textDocument/publishDiagnostics` path is wired through `src/server.ts` and `src/lsp/diagnostics.ts`, with full-document sync on open/change so editor clients receive live parser and resolver diagnostics.
The current packaged CLI entrypoint lives under `src/cli.ts` and is covered by a compiled stdio launch-contract integration test.
The final coc.nvim smoke step is still pending because the current local Neovim profile uses built-in `vim.lsp` and no local `coc.nvim` installation was available on June 19, 2026.

## Build, Test, and Development Commands

The repository now includes the initial Node/TypeScript workspace scaffold:

- `npm install`: install project dependencies.
- `npm run build`: compile TypeScript sources to `dist/`.
- `npm test`: build the project and run the current test suite.
- `npm run dev`: run the TypeScript compiler in watch mode during bootstrap work.

The supported stdio launch contract is now `merls --stdio`, with `node dist/src/cli.js --stdio` as the equivalent local-development invocation.

## Coding Style & Naming Conventions

Use TypeScript throughout the implementation. Prefer small modules with explicit types and single-purpose exports. Use `camelCase` for variables and functions, `PascalCase` for types and classes, and kebab-case for example/config file names.

Keep parser, symbol, and LSP layers separate. Name tests and fixtures after the behavior they cover, for example `parser.labels.test.ts` or `fixtures/invalid/65816-long-a.asm`.

## Testing Guidelines

TDD is mandatory in this repository: add or extend a failing test or fixture before implementation. Positive fixtures must cover supported Merlin-style 6502 syntax. Negative fixtures must explicitly cover unsupported 65816 syntax and expected diagnostics.

Prefer focused unit tests for lexer/parser behavior and integration tests for LSP requests such as `initialize`, hover, and definition.

The current bootstrap test suite already includes compiled-stdio integration checks for the packaged CLI contract, `initialize`, and diagnostics publication.

## Commit & Pull Request Guidelines

This workspace does not currently include accessible git history, so no local commit convention can be inferred from prior commits. Use short, imperative commit subjects such as `Add lexer token fixtures`.

Task completion includes documentation maintenance. When a change affects repository behavior, structure, workflow, or contributor expectations, update both `README.md` and `AGENTS.md` in the same task.

PRs should describe the user-visible behavior change, list the tests added or updated, and include sample diagnostics or editor screenshots when LSP behavior changes. Keep PRs scoped to one phase task or one coherent feature.
