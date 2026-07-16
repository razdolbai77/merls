# Codebase Improvement Plan

## High Priority — Correctness

- [x] Preserve the original lexical token stream when expanding macro body lines in `src/asm/expansion.ts:69-151`; the AST reconstruction drops binary operators, parentheses, index commas, and every data-line token, so expanded arithmetic/indexed/data statements are reparsed incorrectly. Add regression coverage in `test/expansion.test.ts` for `]1+1`, `(]1,x)`, and data directives.
- [x] Make code-action support truthful in `src/server.ts:60-99`, `README.md:26-45`, and `AGENTS.md:51`: either register and implement a supported `textDocument/codeAction` provider with a focused diagnostic quick-fix, or remove the unsupported feature from the advertised capability set and documentation.

## Medium Priority — LSP Behavior and Performance

- [x] Build each call-hierarchy incoming caller item from its enclosing label's line in `src/lsp/call-hierarchy.ts:88-104`, not the `jsr`/`jmp` reference line; add an assertion for the caller item's range in `test/call-hierarchy.test.ts`.
- [x] Make code-lens reference counts actionable in `src/lsp/code-lens.ts:36-42`: register the client command and pass the target URI/locations, or omit the command until navigation can be performed. Cover command id and arguments in `test/code-lens.test.ts`.
- [ ] Replace per-request synchronous recursive workspace reads in `src/server.ts:133-167` and `src/asm/workspace.ts:76-88` with an invalidation-aware workspace cache. Reuse parsed include dependencies until an open or watched document changes.
- [ ] Cache the global symbol and macro-name sets consumed by `buildSemanticTokens` in `src/lsp/semantic-tokens.ts:36-55`; the current request path scans every indexed document on each semantic-token refresh.
- [ ] Pass the already indexed workspace into diagnostics collection instead of rebuilding an include graph once for every open entry in `src/lsp/diagnostics.ts:36-47`; retain diagnostics for all open documents and add a multi-entry workspace regression test.
- [ ] Resolve local labels through `resolveLocalLabels` in `src/lsp/semantic-tokens.ts:53-55`; the current prefix-only check highlights every `]name` and `:name` as resolved, including undefined or out-of-anchor references.
- [ ] Honor `FormattingOptions.tabSize` in `src/lsp/formatting.ts:174-195`; the tab branch always appends exactly one tab and cannot align to columns 8, 16, and 24. Add cases for tab-based formatting with multiple tab sizes.

## Medium Priority — Test Reliability and Coverage

- [ ] Extract the repeated JSON-RPC child-process harness from integration tests such as `test/code-lens.test.ts:6-88` and `test/watched-files.test.ts:6-100` into a shared test helper that rejects on process exit/error and applies a request deadline, so failed server requests cannot hang `npm test` indefinitely.
- [ ] Replace the tautological `diagnostics.length >= 0` assertion in `test/performance.test.ts:41-53` with an observable expected result for the generated macro-heavy document.
- [ ] Remove the fixed 100 ms race in `test/watched-files.test.ts:111-131`; wait for the watched-file update through a bounded condition instead of assuming asynchronous indexing has completed.
- [ ] Add the VS Code extension's `npm test` (`vscode/package.json:123-128`) to the root verification workflow or CI script, so `npm test` validates both published artifacts rather than only the language server.

## Low Priority — Maintainability

- [ ] Centralize macro-expansion limits in `src/asm/diagnostics.ts:234` and `src/asm/expansion.ts:257` as one named constant shared by diagnostics and expansion, preventing the recursion guard and diagnostic threshold from drifting.
- [ ] Add a parser test for a nested `mac` definition that verifies invalid nested definitions are not exposed through macro navigation/indexing after `invalid-macro-nesting` is diagnosed; `src/asm/parser.ts:303-372` currently indexes every `mac` line independently.
