# Codebase Improvement Plan

## High Priority - Bug Fixes & Correctness

- [ ] Fix token dropping in `src/asm/parser.ts`: verify `parsed.nextIndex === tokens.length` after parsing instructions and directives.
- [ ] Fix `parsePrefix` in `src/asm/expression.ts`: handle keywords (like `mnemonic`, `directive`) gracefully when they are used as identifiers/labels.
- [ ] Fix local label scoping in `src/asm/local-labels.ts`: change `qualifyName(localDefinition, currentAnchor.line)` to use the label's own definition line instead of the anchor's line to prevent duplicate labels overwriting each other.
- [ ] Fix LSP Formatting range in `src/lsp/formatting.ts`: adjust `range.end.line` subtraction logic in `formatRange` to account for `range.end.character === 0` (exclusive end line).
- [ ] Fix Call Hierarchy `openDocuments` vs `workspace` in `src/server.ts`: pass `getIndexedDocuments()` instead of `openDocuments` to `prepareCallHierarchy` and `provideCallHierarchyIncomingCalls` to support cross-file analysis.

## Medium Priority - Performance & Architecture

- [ ] Fix LSP server event loop block in `src/server.ts`: replace `fs.readFileSync` inside `onDidChangeWatchedFiles` with asynchronous `fs.promises.readFile`.
- [ ] Fix synchronous workspace reindexing in `src/server.ts`: refactor `getIndexedDocuments()` to avoid calling `indexWorkspace` from scratch on every LSP request. Cache the workspace index and invalidate it intelligently on document changes.
- [ ] Fix O(workspace_size) latency in `src/lsp/semantic-tokens.ts`: stop calling `collectSymbols` on all `indexedDocuments.values()` synchronously per keystroke. Use a globally maintained symbol/macro cache instead.
- [ ] Improve `src/lsp/code-lens.ts` performance: resolve the O(N * M * K) complexity bottleneck and ensure the returned `command` object is fully implemented rather than an empty string.

## Low Priority - Refactoring & Inconsistencies

- [ ] Implement Code Actions stub: `src/lsp/code-actions.ts` is currently an empty, unimplemented stub returning `[]`. Implement relevant quick-fixes or remove the provider advertisement.
- [ ] Clean up redundant path normalization in `src/server.ts`: extract `if (filePath.startsWith("file://")) filePath = fileURLToPath(filePath);` into a shared helper function instead of repeating it in multiple places.
