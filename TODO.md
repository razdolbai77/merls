# Codebase Improvement Plan

## 2026-08-03 Code Quality Audit

### High Priority — Bugs and Safety

- [x] Add a position bounds guard in `src/lsp/selection-range.ts:28-58`: a `pos.line` at or past `lines.length` throws TypeError at `lines[pos.line].length`; return the file range for out-of-bounds positions.
- [x] Fix shell quoting in `vscode/src/compile.ts:11-33`: `quoteWindowsArg` must also quote cmd metacharacters (`& | < > ^ %`), and `quotePosixArg` must quote `; & | < > ( ) * ? [ ] # ~ ^ %` even without spaces, so paths containing them cannot break or inject into the terminal command.
- [x] Guard `src/lsp/rename.ts:12-25` against cross-scope raw-lexeme renames: reject renaming `]N` parameters and `:local`/`]local` labels, and validate `newName` as a Merlin identifier before emitting edits.
- [x] Fix mislocated macro-expansion ranges in `src/lsp/symbol-navigation.ts:181,252`: expanded tokens carry `sourceToken.start/end` columns from the macro definition file but are emitted on call-site lines; map columns through the call-site argument tokens so references and rename stop producing corrupting TextEdits.
- [x] Make `src/server.ts:143-146` diskCache merge safe: it can overwrite unsaved open buffers with stale disk content and creates case-duplicate entries on Windows; skip disk entries whose lowercased path is already present and never overwrite open-document keys.
- [x] Make `src/asm/workspace.ts:78-93` override and diskCache lookups case-insensitive on win32 so includes spelled with different drive/letter case resolve to the open buffer instead of stale disk content.
- [x] Fix unterminated string payloads in `src/asm/expression.ts:256`: `slice(1, -1)` drops the last real character when the lexer returns a string token without closing quote; strip the closing quote only when present.
- [x] Clamp diagnostic columns for macro-expanded lines in `src/asm/diagnostics.ts`: expanded-text character offsets are reported against the original source line; also fix `getUnknownTextPattern` producing `start: -1` on raw-text scans and the `jmp (abs,x)` false positive.
- [x] Bound total expansion output in `src/asm/expansion.ts` `getEffectiveLines` and `traceCalls` in `src/asm/diagnostics.ts`: the depth-only cap in `src/asm/limits.ts` still allows exponential line growth from branching macro chains; add a total-line cap that degrades with `deep-macro-expansion`.
- [x] Handle `sendDiagnostics` rejections in `src/server.ts:112,301` instead of `void`, and bound `diskCache` growth by evicting paths unreachable from any open document's include graph.
- [x] Make equate collection deterministic in `src/lsp/inlay-hints.ts:15-34`: the last-wins Map across documents shows the wrong value for duplicate `equ` names; prefer workspace load order matching diagnostics.
- [x] Include the `token.start` boundary in comment/string completion suppression in `src/lsp/completion.ts` so a cursor exactly at a comment's first character stops receiving completions.

### Medium Priority — Inconsistencies

- [x] Merge the two URI-to-path helpers with divergent win32 case handling: `normalizeUriToPath` (`src/server.ts:33-35`) and `uriToFilePath` (`src/lsp/diagnostics.ts:93-96`) into one canonical helper.
- [x] Export one `isLocalLabel` from `src/asm/local-labels.ts` and delete the identical copies in `src/asm/diagnostics.ts:724` and `src/lsp/completion.ts:176` plus inlined variants in `src/lsp/semantic-tokens.ts:83`, `src/lsp/code-lens.ts:29`, and `src/lsp/selection-range.ts:101`.
- [x] Consolidate the four global-label shape walkers (`src/asm/local-labels.ts:149`, `src/asm/diagnostics.ts:534`, `src/lsp/selection-range.ts:92`, `src/lsp/call-hierarchy.ts:7`) into one helper returning the label token.
- [x] Replace the four near-identical recursive Expression walkers (`src/lsp/symbol-navigation.ts:309`, `src/asm/diagnostics.ts:618`, `src/asm/local-labels.ts:218`, `src/asm/parser.ts:466`) with one shared traversal taking a collector.
- [x] Extract one `isAccumulatorOperand` helper replacing the duplicated blocks in `src/lsp/symbol-navigation.ts:275-285`, `src/asm/diagnostics.ts:561-571`, `src/lsp/hover.ts:54-63`, and `src/lsp/formatting.ts:150-158`.
- [x] Extract one `uniqueLocations` dedupe helper replacing the four `JSON.stringify`-keyed Map dedupes in `src/lsp/symbol-navigation.ts:68,131,195,267`.
- [x] Export one macro-parameter regex constant (with `/u`) replacing the divergent copies in `src/asm/parser.ts:390`, `src/asm/expansion.ts:56`, `src/lsp/symbol-navigation.ts:34`, `src/lsp/semantic-tokens.ts:122`, and `src/asm/diagnostics.ts:282,295,316,337`.
- [x] Unify include handling: share `includeDirectives` between `src/asm/workspace.ts:24` and `src/lsp/document-links.ts:5`, and merge `readIncludePath` (`src/asm/workspace.ts:120-152`) with the weaker `getIncludeTarget` (`src/lsp/document-links.ts:48-79`).
- [x] Standardize import style: move the mid-file import at `src/lsp/semantic-tokens.ts:35` to the top block, use the `vscode-languageserver/node` entry everywhere (`semantic-tokens.ts:2` uses the bare one), and apply external-then-local order with inline `type` modifiers in `src/lsp/formatting.ts:1-5`, `src/lsp/document-links.ts:1-3`, and `src/lsp/call-hierarchy.ts:1-4`.
- [x] Unify handler input shapes and empty results: `src/lsp/document-highlights.ts:5-9` alone takes `cached | undefined` while peers take the documents map, and `src/lsp/selection-range.ts:12-13` returns `null` where array handlers return `[]`.
- [x] Align `vscode/src` with root conventions: double quotes and `node:`-prefixed default imports (`vscode/src/extension.ts:1-3`, `vscode/src/compile.ts:1`), template literals instead of `+` (`extension.ts:82`), and one canonical language id (`asm` in tests vs `6502` in the extension).
- [x] Move the copied `positionOf`/`positionOfLast`/`positionOfInMatch` helpers (`test/completion.test.ts:12-30`, `test/hover.test.ts:14-33`, `test/definition-references.test.ts:12-20`) into `test/helpers/`.
- [x] Port the hand-rolled JSON-RPC framing in `test/server-initialize.test.ts:29-75` to `test/helpers/json-rpc-client.ts` per AGENTS.md.
- [x] Stop `test/watched-files.test.ts:18-21` from writing runtime fixtures into `test/fixtures/valid`; use a temp directory outside the corpus.
- [x] Pick one loop-counter style: `index += 1` in `src/asm/parser.ts:187,308` and `src/asm/symbols.ts:73` versus `i++` elsewhere, and replace the lone `.forEach` line loop in `src/asm/document.ts:63` with for-of.
- [x] Rewrite exploratory and stale comments as factual statements: `src/server.ts:52`, `src/lsp/formatting.ts:95-97`, `src/lsp/semantic-tokens.ts:74,134`.

### Low Priority — Refactoring

- [x] Split `buildCompletionItems` (`src/lsp/completion.ts`, 163 lines) and `findDefinition` (`src/lsp/symbol-navigation.ts`, 113 lines) into per-context builders under 50 lines.
- [x] Split `buildHover` (`src/lsp/hover.ts`, 125 lines) and dedupe the opcode/directive hover content built twice for the token path and node fallback path.
- [x] Split `formatLine` (`src/lsp/formatting.ts`, 101 lines) and export the `col1/col2/col3` constants (lines 87-89) as named values shared with `vscode/src/editor-options.ts`.
- [x] Flatten `provideCallHierarchyOutgoingCalls` (`src/lsp/call-hierarchy.ts`, ~92 lines, 5-6 nesting levels) and hoist the per-iteration `allMacros` flatMaps at `call-hierarchy.ts:131` and `symbol-navigation.ts:167`.
- [x] Deduplicate the copy-pasted token-pasted-name and local-label diagnostic construction in `src/asm/diagnostics.ts:284-350` into one diagnostic factory.
- [x] Share one `]1..]N` macro signature renderer across `src/lsp/hover.ts:79-82`, `src/lsp/completion.ts:113-121`, and `src/lsp/signature-help.ts:30-39` instead of three divergent strategies.
- [x] Skip `untitled:` documents in include resolution (`src/asm/workspace.ts:36-39,110`): `path.dirname("untitled:...")` produces garbage include paths.
- [x] Rename abbreviated locals to descriptive names: `glLine` (`src/lsp/selection-range.ts:38`), `pLine` (`src/lsp/call-hierarchy.ts:9,82`), `bLine`/`def` (`src/asm/diagnostics.ts:251,257`), `dirName` versus `directiveName` (`src/lsp/folding.ts:62` vs `src/asm/parser.ts:256`).


## 2026-07-24 Merlin 32 Compatibility Audit

Reference: <https://brutaldeluxe.fr/products/crossdevtools/merlin/>

### High Priority — Parser and Diagnostic Correctness

- [x] Add current-address `*` as an expression atom in `src/asm/lexer.ts` and `src/asm/expression.ts`; cover `dumSize = *` so `test/fixtures/valid/merlin32-main-6502.S:21` parses without an unresolved `dumSize`.
- [x] Make unbraced Merlin expressions evaluate left-to-right in `src/asm/expression.ts`, then add `{...}` algebraic precedence; cover the documented `1+2*3 = 9` and `{1+2*3} = 7` cases.
- [x] Tokenize and parse Merlin comparison/logical operators `<`, `=`, `>`, `#`, `&`, `.`, and `!` without confusing prefix byte selectors or immediate markers; add focused expression tests for each operator.
- [x] Accept `_` separators in binary literals in `src/asm/lexer.ts`; add `%0000_1111_0000_1111` lexer and parser coverage.
- [x] Model `]name = expression` as a reassignable Merlin variable, not an anchor-scoped backward local label; update symbols, diagnostics, navigation, semantic tokens, and completion with before-definition and redefinition tests.
- [x] Treat `;` inside a macro operand as the documented parameter separator instead of an unconditional comment start; preserve real trailing comments and test `Move #$00;$02`.
- [x] Replace comma-based macro arity, expansion, signature-help, and navigation splitting with shared Merlin parameter splitting in `src/asm/expansion.ts`, `src/asm/diagnostics.ts`, and `src/lsp/signature-help.ts`.
- [x] Implement macro parameter `]0` as the supplied-argument count during expansion; cover zero-, one-, and eight-argument calls.
- [x] Limit positional macro parameters to documented `]1` through `]8`; make completion include `]0` and stop suggesting invalid `]9`/multi-digit placeholders in `src/lsp/completion.ts`.
- [x] Enforce definition-before-use for macros and `EQU` symbols using workspace load order; add forward-call and forward-equate diagnostics without breaking ordinary forward label references.
- [x] Support Merlin's documented nested macro-definition form instead of always emitting `invalid-macro-nesting`; keep nested definitions scoped to the enclosing macro and test the shared `<<<` terminator.
- [x] Evaluate resolvable `DO`/`IF`/`ELSE`/`FIN` branches before unresolved-reference and duplicate-symbol analysis so inactive code does not produce false diagnostics.
- [x] Resolve `USE` through a configured Merlin macro folder, ignore the legacy numeric subfolder prefix, and try the implicit `.s` suffix; cover `USE 4/Int.Macs` outside the source directory.
- [x] Stop indexing and diagnosing source after an `END` directive; add symbols and unresolved references after `END` as negative coverage.

### High Priority — 6502 Syntax Accuracy

- [x] Remove explicit `A` operands from `ASL`/`LSR`/`ROL`/`ROR` acceptance to match Merlin 32's implied-accumulator syntax; add `LSR` as valid and `LSR A` as invalid diagnostic coverage.
- [x] Make direct-page versus absolute addressing validation value-sensitive; reject `STA $00,Y` unless absolute mode is explicitly forced.
- [x] Parse Merlin opcode suffixes that force absolute addressing, including `LDA: $11`, and preserve the suffix through formatting and semantic tokens.
- [x] Add the documented 6502 aliases `BGE`/`BLT` with `BCS`/`BCC` addressing behavior, hover text, completion, and tests.

### Medium Priority — Merlin Directive Coverage

- [x] Add parser metadata and payload coverage for `ADR`, `ADRL`, `PUTBIN`, `CHK`, `DAT`, and `REL`, explicitly documenting any directive excluded by the 6502-only project scope.
- [x] Add `LUP`/`--^` region parsing and variable substitution without implementing object-code generation; diagnose unmatched loop delimiters and unsupported generated `@` labels precisely.
- [x] Parse alternate macro calls `PMC name,args` and `>>> name,args` into the same macro-call model used by direct calls.
- [x] Validate multi-value data/storage operands, including `DS 8,$EE`, `DS \,$A0`, and mixed string/numeric `ASC` payloads.
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
