# Codebase Improvement Plan

## 2026-07-24 Merlin 32 Compatibility Audit

Reference: <https://brutaldeluxe.fr/products/crossdevtools/merlin/>

### High Priority — Parser and Diagnostic Correctness

- [x] Add current-address `*` as an expression atom in `src/asm/lexer.ts` and `src/asm/expression.ts`; cover `dumSize = *` so `test/fixtures/valid/merlin32-main-6502.S:21` parses without an unresolved `dumSize`.
- [x] Make unbraced Merlin expressions evaluate left-to-right in `src/asm/expression.ts`, then add `{...}` algebraic precedence; cover the documented `1+2*3 = 9` and `{1+2*3} = 7` cases.
- [x] Tokenize and parse Merlin comparison/logical operators `<`, `=`, `>`, `#`, `&`, `.`, and `!` without confusing prefix byte selectors or immediate markers; add focused expression tests for each operator.
- [x] Accept `_` separators in binary literals in `src/asm/lexer.ts`; add `%0000_1111_0000_1111` lexer and parser coverage.
- [x] Model `]name = expression` as a reassignable Merlin variable, not an anchor-scoped backward local label; update symbols, diagnostics, navigation, semantic tokens, and completion with before-definition and redefinition tests.
- [ ] Treat `;` inside a macro operand as the documented parameter separator instead of an unconditional comment start; preserve real trailing comments and test `Move #$00;$02`.
- [ ] Replace comma-based macro arity, expansion, signature-help, and navigation splitting with shared Merlin parameter splitting in `src/asm/expansion.ts`, `src/asm/diagnostics.ts`, and `src/lsp/signature-help.ts`.
- [ ] Implement macro parameter `]0` as the supplied-argument count during expansion; cover zero-, one-, and eight-argument calls.
- [ ] Limit positional macro parameters to documented `]1` through `]8`; make completion include `]0` and stop suggesting invalid `]9`/multi-digit placeholders in `src/lsp/completion.ts`.
- [ ] Enforce definition-before-use for macros and `EQU` symbols using workspace load order; add forward-call and forward-equate diagnostics without breaking ordinary forward label references.
- [ ] Support Merlin's documented nested macro-definition form instead of always emitting `invalid-macro-nesting`; keep nested definitions scoped to the enclosing macro and test the shared `<<<` terminator.
- [ ] Evaluate resolvable `DO`/`IF`/`ELSE`/`FIN` branches before unresolved-reference and duplicate-symbol analysis so inactive code does not produce false diagnostics.
- [ ] Resolve `USE` through a configured Merlin macro folder, ignore the legacy numeric subfolder prefix, and try the implicit `.s` suffix; cover `USE 4/Int.Macs` outside the source directory.
- [ ] Stop indexing and diagnosing source after an `END` directive; add symbols and unresolved references after `END` as negative coverage.

### High Priority — 6502 Syntax Accuracy

- [ ] Remove explicit `A` operands from `ASL`/`LSR`/`ROL`/`ROR` acceptance to match Merlin 32's implied-accumulator syntax; add `LSR` as valid and `LSR A` as invalid coverage.
- [ ] Make direct-page versus absolute addressing validation value-sensitive; reject `STA $00,Y` unless absolute mode is explicitly forced.
- [ ] Parse Merlin opcode suffixes that force absolute addressing, including `LDA: $11`, and preserve the suffix through formatting and semantic tokens.
- [ ] Add the documented 6502 aliases `BGE`/`BLT` with `BCS`/`BCC` addressing behavior, hover text, completion, and tests.

### Medium Priority — Merlin Directive Coverage

- [ ] Add parser metadata and payload coverage for `ADR`, `ADRL`, `PUTBIN`, `CHK`, `DAT`, and `REL`, explicitly documenting any directive excluded by the 6502-only project scope.
- [ ] Add `LUP`/`--^` region parsing and variable substitution without implementing object-code generation; diagnose unmatched loop delimiters and unsupported generated `@` labels precisely.
- [ ] Parse alternate macro calls `PMC name,args` and `>>> name,args` into the same macro-call model used by direct calls.
- [ ] Validate multi-value data/storage operands, including `DS 8,$EE`, `DS \,$A0`, and mixed string/numeric `ASC` payloads.
- [ ] Validate `INV` and `FLS` character ranges so lowercase strings receive a targeted diagnostic rather than being advertised as valid.
- [ ] Centralize macro argument splitting now duplicated in `expandMacroCall`, `splitMacroCallArguments`, arity diagnostics, and signature help; remove the stale reference to nonexistent `src/asm/substitution.ts`.

### Medium Priority — Tests and Compatibility Claims

- [ ] Make `test/fixture-corpus.test.ts` assert that every valid fixture parses and produces no diagnostics; it currently checks only file existence and provenance text.
- [ ] Move recursive calls, macro-local labels, and unresolved conditionals out of `test/fixtures/valid/merlin32-macro-coverage.S`, which currently produces five diagnostics despite its `valid` location.
- [ ] Add fixture-driven cases transcribed from the official page for current address, brace precedence, variables, semicolon-separated macro parameters, `]0`, nested macro definitions, and implicit include suffixes.
- [ ] Add exact expected diagnostic-code assertions for every file under `test/fixtures/invalid/` instead of accepting any nonempty provenance marker.
- [ ] Replace README's “comprehensive and fully implemented” claim with a 6502/Merlin syntax coverage matrix and clearly separate intentional 65C02/65C816 exclusions from missing processor-neutral syntax.
- [ ] Remove README and AGENTS references to nonexistent `src/asm/substitution.ts` and `test/substitution.test.ts`, or restore one shared substitution module and its actual test file.

### Medium Priority — `examples/` Improvements

- [ ] Split `examples/EXAMPLE.S` into a diagnostics-free feature showcase and an intentionally invalid diagnostic showcase so users can open a clean starter file.
- [ ] Correct positive examples in `examples/EXAMPLE.S`: use implied `LSR`, replace or force the invalid direct-page `STA $00,Y`, and uppercase `INV`/`FLS` payloads.
- [ ] Remove the unintended unresolved `LDA a` at `examples/EXAMPLE.S:133`, or define the intended symbol and update the addressing-mode example.
- [ ] Add supported official examples for `*`, brace precedence, Merlin variables, semicolon-separated macro parameters, and `]0` after their parser tasks land.
- [ ] Make `examples/coc-settings.json`, its contract test, smoke config, and README agree on filetypes; include both Vim's common `asm` filetype and the extension's `6502` language id unless one canonical id is documented.


## High Priority — Correctness

- [x] Preserve the original lexical token stream when expanding macro body lines in `src/asm/expansion.ts:69-151`; the AST reconstruction drops binary operators, parentheses, index commas, and every data-line token, so expanded arithmetic/indexed/data statements are reparsed incorrectly. Add regression coverage in `test/expansion.test.ts` for `]1+1`, `(]1,x)`, and data directives.
- [x] Make code-action support truthful in `src/server.ts:60-99`, `README.md:26-45`, and `AGENTS.md:51`: either register and implement a supported `textDocument/codeAction` provider with a focused diagnostic quick-fix, or remove the unsupported feature from the advertised capability set and documentation.

## Medium Priority — LSP Behavior and Performance

- [x] Build each call-hierarchy incoming caller item from its enclosing label's line in `src/lsp/call-hierarchy.ts:88-104`, not the `jsr`/`jmp` reference line; add an assertion for the caller item's range in `test/call-hierarchy.test.ts`.
- [x] Make code-lens reference counts actionable in `src/lsp/code-lens.ts:36-42`: register the client command and pass the target URI/locations, or omit the command until navigation can be performed. Cover command id and arguments in `test/code-lens.test.ts`.
- [x] Replace per-request synchronous recursive workspace reads in `src/server.ts:133-167` and `src/asm/workspace.ts:76-88` with an invalidation-aware workspace cache. Reuse parsed include dependencies until an open or watched document changes.
- [x] Cache the global symbol and macro-name sets consumed by `buildSemanticTokens` in `src/lsp/semantic-tokens.ts:36-55`; the current request path scans every indexed document on each semantic-token refresh.
- [x] Pass the already indexed workspace into diagnostics collection instead of rebuilding an include graph once for every open entry in `src/lsp/diagnostics.ts:36-47`; retain diagnostics for all open documents and add a multi-entry workspace regression test.
- [x] Resolve local labels through `resolveLocalLabels` in `src/lsp/semantic-tokens.ts:53-55`; the current prefix-only check highlights every `]name` and `:name` as resolved, including undefined or out-of-anchor references.
- [x] Honor `FormattingOptions.tabSize` in `src/lsp/formatting.ts:174-195`; the tab branch always appends exactly one tab and cannot align to columns 8, 16, and 24. Add cases for tab-based formatting with multiple tab sizes.

## Medium Priority — Test Reliability and Coverage

- [x] Extract the repeated JSON-RPC child-process harness from integration tests such as `test/code-lens.test.ts:6-88` and `test/watched-files.test.ts:6-100` into a shared test helper that rejects on process exit/error and applies a request deadline, so failed server requests cannot hang `npm test` indefinitely.
- [x] Replace the tautological `diagnostics.length >= 0` assertion in `test/performance.test.ts:41-53` with an observable expected result for the generated macro-heavy document.
- [x] Remove the fixed 100 ms race in `test/watched-files.test.ts:111-131`; wait for the watched-file update through a bounded condition instead of assuming asynchronous indexing has completed.
- [x] Add the VS Code extension's `npm test` (`vscode/package.json:123-128`) to the root verification workflow or CI script, so `npm test` validates both published artifacts rather than only the language server.

## Low Priority — Maintainability

- [x] Centralize macro-expansion limits in `src/asm/diagnostics.ts:234` and `src/asm/expansion.ts:257` as one named constant shared by diagnostics and expansion, preventing the recursion guard and diagnostic threshold from drifting.
- [x] Add a parser test for a nested `mac` definition that verifies invalid nested definitions are not exposed through macro navigation/indexing after `invalid-macro-nesting` is diagnosed; `src/asm/parser.ts:303-372` currently indexes every `mac` line independently.
