# Codebase Improvement Plan

## High Priority - Bug Fixes

- [x] Fix incorrect `Location` ranges in `src/lsp/document-symbols.ts`'s `createLocation`. It currently hardcodes `start.character: 0` instead of using the actual token offset.
- [x] Fix incorrect `Location` ranges in `src/lsp/symbol-navigation.ts`'s `createLocation` to use the actual character start and end index from the lexed token instead of just `name.length` from index 0.

## Medium Priority - Performance Optimization

- [x] Introduce a document caching layer in `src/server.ts` to store `ParsedDocument` and `LexedSource` alongside the document source text. Currently, `parseDocument(source)` and `lexSource(source)` are called redundantly on every `onHover`, `onDefinition`, `onReferences`, etc.
- [x] Refactor `findReferences` in `src/lsp/symbol-navigation.ts` to avoid parsing the same document multiple times (it currently calls `parseDocument` inside both `collectDefinitions` and `collectReferences`).
- [x] Prevent redundant parsing in `buildWorkspaceSymbols` (`src/lsp/workspace-symbols.ts`) by iterating over cached documents instead of reparsing the source.

## Low Priority - Refactoring

- [x] Extract the duplicated `tokenAtCharacter` function found in `src/lsp/hover.ts:82` and `src/lsp/symbol-navigation.ts:91` into a shared utility file (e.g., `src/lsp/utils.ts` or `src/asm/lexer.ts`).
- [x] Enrich the `ParsedLine` AST nodes in `src/asm/parser.ts` to carry token positional information (`start` and `end` indices) so LSP features can construct accurate ranges without needing to fall back to the lexer.
