# Repository Guidelines

## Project Structure & Module Organization

This repository is in the bootstrap stage. Today, the main documents are `README.md` for scope and `PLAN.md` for the implementation checklist. The planned runtime is Node.js with TypeScript and `vscode-languageserver`.

When the workspace is scaffolded, keep code under `src/`, tests under `test/`, and editor integration examples under `examples/` such as `examples/coc-settings.json`. Store parser fixtures in a dedicated test-fixture area and separate valid 6502 cases from invalid 65816 cases.

The current bootstrap entrypoint is `src/server.ts`, which compiles to `dist/src/server.js`.
The repository now includes `examples/coc-settings.json` as the baseline coc.nvim launch example.
The initial positive fixture corpus now lives under `test/fixtures/valid/` and is transcribed from upstream Merlin32 sources.

## Build, Test, and Development Commands

The repository now includes the initial Node/TypeScript workspace scaffold:

- `npm install`: install project dependencies.
- `npm run build`: compile TypeScript sources to `dist/`.
- `npm test`: build the project and run the current test suite.
- `npm run dev`: run the TypeScript compiler in watch mode during bootstrap work.

Update this section again when the stdio server entrypoint replaces the temporary bootstrap-oriented dev loop.

## Coding Style & Naming Conventions

Use TypeScript throughout the implementation. Prefer small modules with explicit types and single-purpose exports. Use `camelCase` for variables and functions, `PascalCase` for types and classes, and kebab-case for example/config file names.

Keep parser, symbol, and LSP layers separate. Name tests and fixtures after the behavior they cover, for example `parser.labels.test.ts` or `fixtures/invalid/65816-long-a.asm`.

## Testing Guidelines

TDD is mandatory in this repository: add or extend a failing test or fixture before implementation. Positive fixtures must cover supported Merlin-style 6502 syntax. Negative fixtures must explicitly cover unsupported 65816 syntax and expected diagnostics.

Prefer focused unit tests for lexer/parser behavior and integration tests for LSP requests such as `initialize`, hover, and definition.

The current bootstrap test suite already includes an `initialize` integration check against the compiled stdio server.

## Commit & Pull Request Guidelines

This workspace does not currently include accessible git history, so no local commit convention can be inferred from prior commits. Use short, imperative commit subjects such as `Add lexer token fixtures`.

Task completion includes documentation maintenance. When a change affects repository behavior, structure, workflow, or contributor expectations, update both `README.md` and `AGENTS.md` in the same task.

PRs should describe the user-visible behavior change, list the tests added or updated, and include sample diagnostics or editor screenshots when LSP behavior changes. Keep PRs scoped to one phase task or one coherent feature.
