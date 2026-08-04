# Repository Guidelines

## Project Structure & Module Organization

This repository has an established baseline. The main document is `README.md` for scope. The runtime is Node.js with TypeScript and `vscode-languageserver`.

When the workspace is scaffolded, keep code under `src/`, tests under `test/`, and editor integration examples under `examples/` such as `examples/coc-settings.json`. Store parser fixtures in a dedicated test-fixture area and separate valid 6502 cases from invalid unknown-syntax cases.

The current bootstrap server entrypoint is `src/server.ts`, and the packaged CLI entrypoint is `src/cli.ts`, which compiles to `dist/src/cli.js`.
The repository now includes `examples/coc-settings.json` as the baseline coc.nvim launch example, targeting `dist/src/cli.js --stdio` with `.git` and `package.json` root markers.
The initial positive fixture corpus now lives under `test/fixtures/valid/` and is transcribed from upstream Merlin32 sources.
The initial negative fixture corpus now lives under `test/fixtures/invalid/` and captures invalid unknown-syntax coverage samples.
The fixture corpus now also includes dedicated macro coverage samples under `test/fixtures/valid/merlin32-macro-coverage.S` and `test/fixtures/invalid/macro-generated-unresolved.S` for nested calls, zero-argument macros, local labels, conditional assembly, and macro-generated unresolved references.
The parser test suite now explicitly locks down current macro-call parsing and the present `mac`/`eom`/`<<<` line behavior before macro-parser refactors.
Shared 6502 opcode and Merlin32 directive metadata now lives under `src/asm/metadata.ts`.
Shared token-kind and line-shape metadata now lives under `src/asm/syntax.ts`.
The current lexer implementation now lives under `src/asm/lexer.ts` and is covered by fixture-driven unit tests.
The current expression parser recognizes decimal, hexadecimal, and separator-formatted binary literals, current-address `*`, left-to-right Merlin arithmetic, brace-controlled algebraic precedence, comparison/logical operators, modifiers, and indexed operands; `test/expression.test.ts` covers each form.
The current line parser now lives under `src/asm/parser.ts` and classifies equates, instructions, directives, data lines, and malformed input.
The current parser also exposes first-class macro definition regions with body lines, closing directives, positional parameter placeholder references, nested macro-call usage, symbol references, and invalid macro-local label definitions/references for diagnostics; illegal nested `mac` definitions are diagnostic-only and excluded from macro navigation/indexing.
The current document model now lives under `src/asm/document.ts` and preserves line-by-line structure while collecting malformed-line errors.
The current document model also exposes explicit macro definition, macro body, parameter-reference, nested-macro-call, symbol-reference, and invalid macro-local-label structures for downstream macro-aware analysis.
The current expansion analysis layer now lives under `src/asm/expansion.ts` and provides a virtual macro expansion view whose tokens carry a `callSiteToken` mapping: argument-derived tokens resolve to the outermost concrete call-site argument token through nested expansions, while macro-body-derived tokens carry `null` so navigation never emits macro-body columns on call-site lines.
The current macro index now lives under `src/asm/macros.ts` and summarizes per-document and per-workspace macro definitions, body ranges, positional parameter counts, referenced symbols, nested macro calls, and invalid macro-local label usage.
The current symbol collector now lives under `src/asm/symbols.ts` and indexes labels, equates, named storage/data definitions, and macros through one shared symbol-record shape that carries token locations plus attached macro-definition metadata for macro symbols.
The current signature-help implementation now resolves macro arity from indexed parsed macro definitions instead of rescanning macro body text ad hoc.
The current signature-help test coverage explicitly includes zero-argument macros, multi-digit positional parameters, nested expressions, and top-level comma tracking for active-parameter selection.
The current diagnostics pass now also emits macro-specific failures for unsupported-instruction-or-undefined-macro call sites, duplicate macro definitions, missing `eom`/`<<<` terminators, illegal nested macro definitions, and obvious arity mismatches.
Unresolved-reference analysis and syntax validation now treat `HEX` directive payloads as raw hexadecimal data rather than symbol names: groups must contain only `0-9A-F` digits, each group must have an even number of digits, groups may be adjacent or comma-separated, and the usual `$` prefix omission applies only inside `HEX`.
Macro-definition and macro-call diagnostics now preserve token-based character spans through `src/asm/diagnostics.ts` and `src/lsp/diagnostics.ts` so editor highlights are narrower and testable.
The initial parameter-substitution model now lives under `src/asm/substitution.ts` and maps macro call arguments onto parsed `]n` placeholder uses inside macro bodies while collecting referenced symbols from each argument expression.
The current substitution test coverage explicitly includes repeated placeholder use, unused trailing arguments, parenthesized argument expressions, and arguments that reference multiple concrete symbols.
Reference collection in `src/lsp/symbol-navigation.ts` now attributes macro-expanded symbol uses back to the concrete argument tokens at the macro call site instead of only treating the macro name as the reference, and expanded ranges use the `callSiteToken` mapping so references and rename edits land on the correct call-site columns.
Definition lookup now resolves identifier uses inside macro-expanded contexts (like parameter placeholders) through parameter substitution to the real symbol definitions supplied at the call sites.
Macro-aware definition/reference coverage now includes call-site symbol resolution through nested macro calls, ensuring navigation lands on the concrete symbol definition supplied to the macro rather than on the macro symbol itself.
Rename planning now propagates through macro-expanded call-site symbol references, so renaming a concrete symbol updates both its definition and the macro call arguments that expand to that symbol.
Rename coverage now includes nested macro-call expansion paths, ensuring the propagated edit set still targets only the concrete symbol definition and call-site argument tokens rather than macro placeholders.
Rename rejects cross-scope targets: macro parameter placeholders (`]1`-style) and `:local`/`]local` labels fail with a descriptive error, and the new name must be a valid Merlin identifier. Renaming a Merlin variable preserves its `]` prefix.
Local-label resolution is limited to ordinary Merlin anchor-based locals; local labels inside macros are rejected to match Merlin32 behavior.
Local-label coverage now also exercises that macro-local labels remain unresolved while ordinary Merlin anchor-based locals before or after a macro call still resolve normally.
Hover now recognizes macro call sites directly, showing parsed positional signatures and macro definition lines instead of only falling back to generic symbol hover text.
The current local-label resolver now lives under `src/asm/local-labels.ts` and resolves Merlin32 `]local` and `:local` labels within the nearest global-label scope.
The current workspace indexer now lives under `src/asm/workspace.ts` and follows `asm`/`put`/`use` directives across the local fixture corpus.
The current diagnostics pass now lives under `src/asm/diagnostics.ts` and reports duplicate symbols, unresolved references, malformed lines, unsupported-instruction cases, and unknown directive/syntax cases.
The current `textDocument/documentSymbol` provider is wired through `src/server.ts` and `src/lsp/document-symbols.ts`.
The current `workspace/symbol` provider is wired through `src/server.ts` and `src/lsp/workspace-symbols.ts` over the open-document symbol set.
The current `textDocument/definition` and `textDocument/references` handlers are wired through `src/server.ts` and `src/lsp/symbol-navigation.ts`.
The current `textDocument/hover` handler is wired through `src/server.ts` and `src/lsp/hover.ts`.
The current `textDocument/completion` handler provides contextual suggestions for macro names, macro parameters (using parsed positional indices), opcodes, directives, and expansion-aware symbols depending on the enclosing macro definition or call site; it advertises Merlin identifier characters as completion triggers, scopes local-label candidates to the active global-label anchor, and token completions include explicit replacement ranges so local-label prefixes are not duplicated.
The current `textDocument/semanticTokens` handler is wired through `src/server.ts` and `src/lsp/semantic-tokens.ts`.
The parser models `]name = expression` as a reassignable Merlin variable rather than an anchor-scoped local label; symbols, diagnostics, navigation, completion, and semantic tokens preserve that distinction.
Macro call argument separators are adjacent semicolons (`Move #$00;$02`); whitespace before `;` keeps ordinary trailing-comment behavior.
Macro parameter splitting is centralized in `src/asm/expansion.ts`, so expansion, arity diagnostics, signature help, and navigation all preserve comma-containing operands as one argument.
Macro placeholder `]0` expands to the supplied argument count, and macros using it accept variable arity without `macro-arity-mismatch` diagnostics.
The current `textDocument/publishDiagnostics` path is wired through `src/server.ts` and `src/lsp/diagnostics.ts`, with full-document sync on open/change so editor clients receive live parser and resolver diagnostics across the entire watched workspace.
Additional advanced LSP handlers for rename, formatting, folding, document highlights, inlay hints, signature help, call hierarchy, code lenses, document links, and selection ranges are also fully wired through `src/server.ts` to their respective modules in `src/lsp/`.
The selection-range provider guards out-of-bounds positions: a line outside the document returns the plain whole-file range instead of throwing.
Auto-formatting now uppercases known instructions and directives while preserving labels, macro-call identifiers, and operand text as written.
The current packaged CLI entrypoint lives under `src/cli.ts` and is covered by a compiled stdio launch-contract integration test.
The integration tests share `test/helpers/json-rpc-client.ts`; use it for stdio JSON-RPC servers so requests reject on child-process exit/error and time out rather than hanging `npm test`.
The coc.nvim smoke test now lives under `test/smoke/` with a headless Vim runner (`run-smoke.ps1`) and a minimal vimrc that isolates the test from the user's real Vim configuration.
A fully standalone Visual Studio Code extension is located under the `vscode/` directory, which relies on the bundled server codebase and TextMate fallbacks.
The VS Code extension's F5 development launch builds the root language server before starting the extension watcher, ensuring the Extension Development Host runs the current `dist/src/cli.js`.
The current Visual Studio Code extension now contributes `Pearls: Compile Current File with Merlin32` and `Pearls: Assemble Project with Merlin32` commands that run `merlin32 <macro-folder> <source-or-entry-file>` in an integrated terminal, configurable via `pearls.merlin32Executable`, `pearls.compileArgs`, `pearls.merlin32MacroFolder`, and `pearls.merlin32ProjectEntryFile`, with the current file's directory used when the macro-folder setting is unset.
The compile-command builder in `vscode/src/compile.ts` quotes terminal arguments against shell metacharacters (`& | < > ^ %` on Windows, `; & | < > ( ) * ? [ ] # ~ ^ %` on POSIX) so configured paths cannot break out of or inject into the integrated-terminal command.
The current Visual Studio Code extension also sets the language-scoped defaults `editor.tabSize = 8`, `editor.indentSize = 8`, and `editor.quickSuggestions = true` for files using the `6502` language, and it actively reapplies `tabSize = 8` to visible `6502` editors at runtime.
Cross-file symbol and macro resolution for semantic tokens ensures robust syntax highlighting without relying purely on TextMate scopes.
URI normalization is strictly enforced inside `getIndexedDocuments()` to prevent duplicate workspace index entries on Windows due to case mismatches.
LSP diagnostics also deduplicate indexed URI aliases by normalized file path and retain the open-document URI for publication, preventing a cached alias from producing a duplicate symbol on its own definition line.
The macro index and expansion-analysis layer now incorporate targeted caching and invalidation logic so that unaffected macro calls are not wastefully re-expanded during typing.
The workspace index cache is invalidated after watched-file reloads complete as well as before they start, preventing requests that race the asynchronous read from preserving stale index contents.
Performance regression benchmarks now lock down responsiveness on massive, macro-heavy synthetic documents.
Strict guardrails and distinct diagnostics (`macro-recursion`, `deep-macro-expansion`, `token-pasted-name`, `unresolved-conditional`) prevent infinite loops and ensure predictably degraded fallback behavior when the parser encounters unsupported macro techniques. `src/asm/limits.ts` defines the shared macro-expansion depth limit used by diagnostics and expansion.

## Build, Test, and Development Commands

The repository now includes the initial Node/TypeScript workspace scaffold:

- `npm install`: install project dependencies.
- `npm run lint`: run ESLint on the project to check for linting errors and warnings.
- `npm run build`: compile TypeScript sources to `dist/`.
- `npm test`: run linting, build the project, and run both language-server and Visual Studio Code extension test suites.
- `npm run dev`: run the TypeScript compiler in watch mode during bootstrap work.
- `cd vscode && npm test`: compile the Visual Studio Code extension and run its unit tests.

The supported stdio launch contract is now `merls --stdio`, with `node dist/src/cli.js --stdio` as the equivalent local-development invocation.

## Coding Style & Naming Conventions

Use TypeScript throughout the implementation. Prefer small modules with explicit types and single-purpose exports. Use `camelCase` for variables and functions, `PascalCase` for types and classes, and kebab-case for example/config file names.

Keep parser, symbol, and LSP layers separate. Name tests and fixtures after the behavior they cover, for example `parser.labels.test.ts` or `fixtures/invalid/unknown-addressing-modifiers.S`.

## Testing and Linting Guidelines

TDD is mandatory in this repository: add or extend a failing test or fixture before implementation. Positive fixtures must cover supported Merlin32-style 6502 syntax. Negative fixtures must explicitly cover unknown or unsupported syntax and expected diagnostics.

Linting is enforced using ESLint. No task can be called complete unless both linting (`npm run lint`) and tests (`npm test`) pass 100% with no warnings. Disabling linting rules (e.g. using `// eslint-disable`) is absolutely forbidden.

Prefer focused unit tests for lexer/parser behavior and integration tests for LSP requests such as `initialize`, hover, and definition.

The current bootstrap test suite already includes compiled-stdio integration checks for the packaged CLI contract, `initialize`, and diagnostics publication.

## Commit & Pull Request Guidelines

This workspace does not currently include accessible git history, so no local commit convention can be inferred from prior commits. Use short, imperative commit subjects such as `Add lexer token fixtures`.

Task completion includes documentation maintenance. When a change affects repository behavior, structure, workflow, or contributor expectations, update both `README.md` and `AGENTS.md` in the same task.

PRs should describe the user-visible behavior change, list the tests added or updated, and include sample diagnostics or editor screenshots when LSP behavior changes. Keep PRs scoped to one phase task or one coherent feature.
