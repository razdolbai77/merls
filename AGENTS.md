# Repository Guidelines

## Project Structure & Module Organization

This repository has an established baseline. The main document is `README.md` for scope. The runtime is Node.js with TypeScript and `vscode-languageserver`.

When the workspace is scaffolded, keep code under `src/`, tests under `test/`, and editor integration examples under `examples/` such as `examples/coc-settings.json`. Store parser fixtures in a dedicated test-fixture area and separate valid 6502 cases from invalid 65816 cases.

The current bootstrap server entrypoint is `src/server.ts`, and the packaged CLI entrypoint is `src/cli.ts`, which compiles to `dist/src/cli.js`.
The repository now includes `examples/coc-settings.json` as the baseline coc.nvim launch example, targeting `dist/src/cli.js --stdio` with `.git` and `package.json` root markers.
The initial positive fixture corpus now lives under `test/fixtures/valid/` and is transcribed from upstream Merlin32 sources.
The initial negative fixture corpus now lives under `test/fixtures/invalid/` and captures unsupported 65816-only syntax.
The fixture corpus now also includes dedicated macro coverage samples under `test/fixtures/valid/merlin32-macro-coverage.S` and `test/fixtures/invalid/macro-generated-unresolved.S` for nested calls, zero-argument macros, local labels, conditional assembly, and macro-generated unresolved references.
The parser test suite now explicitly locks down current macro-call parsing and the present `mac`/`eom`/`<<<` line behavior before macro-parser refactors.
Shared 6502 opcode and Merlin32 directive metadata now lives under `src/asm/metadata.ts`.
Shared token-kind and line-shape metadata now lives under `src/asm/syntax.ts`.
The current lexer implementation now lives under `src/asm/lexer.ts` and is covered by fixture-driven unit tests.
The current expression parser now lives under `src/asm/expression.ts` and is covered by unit tests for numeric forms, modifiers, arithmetic, and indexed operands.
The current line parser now lives under `src/asm/parser.ts` and classifies equates, instructions, directives, data lines, and malformed input.
The current parser also exposes first-class macro definition regions with body lines, closing directives, positional parameter placeholder references, nested macro-call usage, symbol references, and macro-local label definitions/references.
The current document model now lives under `src/asm/document.ts` and preserves line-by-line structure while collecting malformed-line errors.
The current document model also exposes explicit macro definition, macro body, parameter-reference, nested-macro-call, symbol-reference, and macro-local-label structures for downstream macro-aware analysis.
The current macro index now lives under `src/asm/macros.ts` and summarizes per-document and per-workspace macro definitions, body ranges, positional parameter counts, referenced symbols, nested macro calls, and macro-local label usage.
The current symbol collector now lives under `src/asm/symbols.ts` and indexes labels, equates, named storage/data definitions, and macros through one shared symbol-record shape that carries token locations plus attached macro-definition metadata for macro symbols.
The current signature-help implementation now resolves macro arity from indexed parsed macro definitions instead of rescanning macro body text ad hoc.
The current signature-help test coverage explicitly includes zero-argument macros, multi-digit positional parameters, nested expressions, and top-level comma tracking for active-parameter selection.
The current diagnostics pass now also emits macro-specific failures for unresolved macro calls, duplicate macro definitions, missing `eom`/`<<<` terminators, illegal nested macro definitions, and obvious arity mismatches.
Macro-definition and macro-call diagnostics now preserve token-based character spans through `src/asm/diagnostics.ts` and `src/lsp/diagnostics.ts` so editor highlights are narrower and testable.
The current local-label resolver now lives under `src/asm/local-labels.ts` and resolves Merlin32 `]local` and `:local` labels within the nearest global-label scope.
The current workspace indexer now lives under `src/asm/workspace.ts` and follows `asm`/`put`/`use` directives across the local fixture corpus.
The current diagnostics pass now lives under `src/asm/diagnostics.ts` and reports duplicate symbols, unresolved references, malformed lines, and unsupported 65816-only syntax.
The current `textDocument/documentSymbol` provider is wired through `src/server.ts` and `src/lsp/document-symbols.ts`.
The current `workspace/symbol` provider is wired through `src/server.ts` and `src/lsp/workspace-symbols.ts` over the open-document symbol set.
The current `textDocument/definition` and `textDocument/references` handlers are wired through `src/server.ts` and `src/lsp/symbol-navigation.ts`.
The current `textDocument/hover` handler is wired through `src/server.ts` and `src/lsp/hover.ts`.
The current `textDocument/completion` handler is wired through `src/server.ts` and `src/lsp/completion.ts`.
The current `textDocument/semanticTokens` handler is wired through `src/server.ts` and `src/lsp/semantic-tokens.ts`.
The current `textDocument/publishDiagnostics` path is wired through `src/server.ts` and `src/lsp/diagnostics.ts`, with full-document sync on open/change so editor clients receive live parser and resolver diagnostics across the entire watched workspace.
Additional advanced LSP handlers for rename, formatting, folding, document highlights, inlay hints, signature help, call hierarchy, code actions, code lenses, document links, and selection ranges are also fully wired through `src/server.ts` to their respective modules in `src/lsp/`.
The current packaged CLI entrypoint lives under `src/cli.ts` and is covered by a compiled stdio launch-contract integration test.
The coc.nvim smoke test now lives under `test/smoke/` with a headless Vim runner (`run-smoke.ps1`) and a minimal vimrc that isolates the test from the user's real Vim configuration.
A fully standalone Visual Studio Code extension is located under the `vscode/` directory, which relies on the bundled server codebase and TextMate fallbacks.
The current Visual Studio Code extension now contributes `Pearls: Compile Current File with Merlin32` and `Pearls: Assemble Project with Merlin32` commands that run `merlin32 <macro-folder> <source-or-entry-file>` in an integrated terminal, configurable via `pearls.merlin32Executable`, `pearls.compileArgs`, `pearls.merlin32MacroFolder`, and `pearls.merlin32ProjectEntryFile`, with the current file's directory used when the macro-folder setting is unset.
Cross-file symbol and macro resolution for semantic tokens ensures robust syntax highlighting without relying purely on TextMate scopes.
URI normalization is strictly enforced inside `getIndexedDocuments()` to prevent duplicate workspace index entries on Windows due to case mismatches.

## Build, Test, and Development Commands

The repository now includes the initial Node/TypeScript workspace scaffold:

- `npm install`: install project dependencies.
- `npm run lint`: run ESLint on the project to check for linting errors and warnings.
- `npm run build`: compile TypeScript sources to `dist/`.
- `npm test`: run linting, build the project, and run the current test suite.
- `npm run dev`: run the TypeScript compiler in watch mode during bootstrap work.
- `cd vscode && npm test`: compile the Visual Studio Code extension and run its unit tests.

The supported stdio launch contract is now `merls --stdio`, with `node dist/src/cli.js --stdio` as the equivalent local-development invocation.

## Coding Style & Naming Conventions

Use TypeScript throughout the implementation. Prefer small modules with explicit types and single-purpose exports. Use `camelCase` for variables and functions, `PascalCase` for types and classes, and kebab-case for example/config file names.

Keep parser, symbol, and LSP layers separate. Name tests and fixtures after the behavior they cover, for example `parser.labels.test.ts` or `fixtures/invalid/65816-long-a.S`.

## Testing and Linting Guidelines

TDD is mandatory in this repository: add or extend a failing test or fixture before implementation. Positive fixtures must cover supported Merlin32-style 6502 syntax. Negative fixtures must explicitly cover unsupported 65816 syntax and expected diagnostics.

Linting is enforced using ESLint. No task can be called complete unless both linting (`npm run lint`) and tests (`npm test`) pass 100% with no warnings. Disabling linting rules (e.g. using `// eslint-disable`) is absolutely forbidden.

Prefer focused unit tests for lexer/parser behavior and integration tests for LSP requests such as `initialize`, hover, and definition.

The current bootstrap test suite already includes compiled-stdio integration checks for the packaged CLI contract, `initialize`, and diagnostics publication.

## Commit & Pull Request Guidelines

This workspace does not currently include accessible git history, so no local commit convention can be inferred from prior commits. Use short, imperative commit subjects such as `Add lexer token fixtures`.

Task completion includes documentation maintenance. When a change affects repository behavior, structure, workflow, or contributor expectations, update both `README.md` and `AGENTS.md` in the same task.

PRs should describe the user-visible behavior change, list the tests added or updated, and include sample diagnostics or editor screenshots when LSP behavior changes. Keep PRs scoped to one phase task or one coherent feature.
