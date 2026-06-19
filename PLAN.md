# Merlin-style 6502 language server plan

## Problem

Build a new standalone language server for Merlin-style 6502 assembly, intended to work with coc.nvim over standard LSP/stdio. The repository is currently empty, so this is a greenfield project.

## Current state

- `C:\Users\alexe\Projects\merls` has no source, build tooling, tests, or documentation yet.
- coc.nvim can run a custom stdio language server from `coc-settings.json`, so a plain LSP server is sufficient for the MVP.
- Upstream Merlin32 examples are useful as syntax corpus, but this project is **6502-only**.
- 65816 constructs are explicitly out of scope and should be diagnosed as unsupported, not deferred for later support.

## Working rules

- Use **TypeScript + Node + `vscode-languageserver`** for the server.
- Use **TDD from the start**: every implementation task begins by adding or extending a failing test or fixture, then implementing the minimum code to make it pass.
- Do **not** treat unit testing as a separate phase; tests are part of each task below.
- Keep the MVP parser-based. External `merlin32` invocation is a later enhancement, not part of the first implementation pass.

## Task list

### Phase 1 - Project bootstrap

- [x] Create the Node/TypeScript workspace skeleton (`package.json`, `tsconfig.json`, source/test directories, build scripts, test runner).
- [x] Create the initial CLI server entrypoint (`src/server.ts`) that starts an empty stdio LSP connection.
- [x] Add the first red/green test proving the server process starts and answers `initialize`.
- [x] Write the initial `README.md` and `examples/coc-settings.json` skeleton so the target coc.nvim integration is fixed early.

### Phase 2 - 6502 Merlin syntax corpus and metadata

- [x] Import or transcribe a minimal real-world fixture corpus from Merlin32 examples, keeping only 6502-valid cases for positive fixtures.
- [x] Add negative fixtures for 65816-only syntax so unsupported constructs are explicitly recognized by tests.
- [x] Define the 6502 opcode table and Merlin-style directive table the parser and LSP features will share.
- [x] Define the token kinds and line-shape rules for comments, labels, local labels, directives, strings, numeric literals, modifiers, and expressions.

### Phase 3 - Parser and document model

- [x] Implement the lexer against the fixture corpus, starting with comments, whitespace, labels, mnemonics, directives, and literals.
- [x] Implement expression parsing for Merlin-style numeric forms, unary modifiers, arithmetic, and indexed addressing fragments.
- [x] Implement line parsing for equates, instructions, directives, data definitions, and malformed lines.
- [x] Implement a document model that preserves line structure and tolerant parse errors instead of failing hard on the first bad token.

### Phase 4 - Symbols and cross-file analysis

- [x] Implement symbol collection for global labels, equates, and named data definitions.
- [x] Implement local-label scope resolution for Merlin-style local labels such as `]loop` and `:label`.
- [x] Implement include/use file graph handling and workspace re-indexing.
- [x] Implement diagnostics for duplicate symbols, unresolved references, malformed expressions, and unsupported 65816 syntax.

### Phase 5 - LSP MVP

- [ ] Implement `textDocument/documentSymbol` on top of the parsed document model.
- [ ] Implement `workspace/symbol` on top of the workspace symbol index.
- [ ] Implement `textDocument/definition` and `textDocument/references` for labels and equates.
- [ ] Implement `textDocument/hover` for opcodes, directives, and resolved symbols.
- [ ] Implement `textDocument/completion` for opcodes, directives, and in-scope symbols.
- [ ] Implement `textDocument/publishDiagnostics` wiring so parser and resolver errors appear in coc.nvim.

### Phase 6 - Packaging and acceptance

- [ ] Finalize the documented CLI contract for launching the server with stdio.
- [ ] Finalize coc.nvim setup documentation and example configuration for the server.
- [ ] Run a manual coc.nvim smoke workflow against sample assembly files and capture any gaps back into the task list.

## Validation

- Every task above is completed with TDD: add failing test/fixture first, then implementation.
- Keep golden fixtures for both accepted 6502 syntax and rejected 65816 syntax.
- Use the final manual coc.nvim smoke workflow only after the LSP MVP features are in place.

## Open questions

None currently.
