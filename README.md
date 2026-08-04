# merls

`merls` is a powerful Language Server for **Merlin32-style 6502 assembly**. It provides a rich set of intelligent IDE features and includes a fully-fledged **Visual Studio Code extension** as well as a standalone server published to npm (e.g., for **coc.nvim**).

## Status

`merls` covers the 6502 core of Merlin32 syntax and the full LSP feature set listed below. It is an editor language server, not an assembler backend: it parses, diagnoses, and navigates source but never emits object code. The repository includes:
1. A standalone Language Server (`@razdolbai/merls`) published to npm for use with Neovim/Vim.
2. A bundled VS Code Extension (in the `vscode/` directory) for a plug-and-play graphical editor experience.

### 6502 / Merlin syntax coverage

| Area | Status |
|------|--------|
| 6502 opcodes | All 56 documented mnemonics plus the `BGE`/`BLT` branch aliases (58 table entries), including implied-accumulator `ASL`/`LSR`/`ROL`/`ROR` and the 65C02 `jmp (abs,x)` indirect-X form |
| Addressing modes | Immediate, zero-page, zero-page indexed, absolute, absolute indexed, indirect, indexed indirect, indirect indexed, relative; value-aware zero-page/absolute selection with `:` absolute-forcing suffixes |
| Merlin expressions | `*` current address, left-to-right evaluation, `{...}` algebraic precedence, `= < > # & . !` operators, modifiers, indexed operands |
| Macros | `mac`/`eom`/`<<<` regions, nested definitions, positional `]1`–`]8` parameters, `]0` argument count, `PMC`/`>>>` alternate call forms, `;` argument separators |
| Variables & locals | Reassignable `]name` variables, anchor-scoped `]local`/`:local` labels |
| Flow control | `DO`/`ELSE`/`FIN`, `IF`, `LUP`/`--^` repeat regions (parse-only), `END` cut-off |
| Storage & data | `DS` count/fill with `\` continuation, `ASC` mixed string/numeric payloads, `INV`/`FLS` range validation, `HEX`, `DFB`/`DB`/`DA`/`DDB`/`DW`/`DCI`/`STR`/`STRL`/`REV` |
| Includes | `ASM`/`PUT`/`USE` with macro-folder resolution and implicit `.s` suffix |

#### Intentional 65C02 / 65C816 exclusions

These forms are rejected with targeted diagnostics by design (6502-only scope):

- Opcodes: `STZ`, `BRA`, `PHX`/`PHY`/`PLX`/`PLY`, `TRB`/`TSB`, `BBS`/`BBR`/`RMB`/`SMB`, `STP`/`WAI`, `MVN`/`MVP`, `PEA`/`PEI`/`PER`
- Explicit `A` accumulator operands on shifts and rotates (Merlin32 uses the implied form)
- 65816 long addressing and width-control directives (`MX`, `XC`)

#### Processor-neutral syntax that is not implemented

- Object code generation of any kind, including `LUP` repeat expansion
- Assembly semantics behind `ADR`, `ADRL`, `PUTBIN`, `CHK`, `DAT`, and `REL` payloads — payloads are parsed and preserved, never assembled

## Goals

- Provide a standalone LSP server over stdio
- Provide a seamless out-of-the-box experience in VS Code via the native extension
- Work cleanly with coc.nvim through standard language-server configuration
- Support Merlin32-style 6502 source structure, symbols, directives, and expressions
- Deliver useful editing features before deeper assembler integration

## Scope

### In Scope

- 6502-only Merlin32-style assembly
- Parser-based diagnostics
- Cross-file symbol resolution via `USE`, `PUT`, and `ASM`
- Labels, equates, and macros accept `;! ` doc comments on the definition line or on consecutive lines immediately before the definition; symbol hover appends the documentation at call sites.
- Extensive LSP features including:
  - diagnostics
  - hover
  - completion
  - go to definition
  - find references
  - document symbols
  - workspace symbols
  - semantic tokens (syntax highlighting)
  - rename
  - formatting (document, range, on-type)
  - folding ranges
  - document highlights
  - inlay hints
  - signature help
  - call hierarchy
  - code lens
  - document links
  - selection ranges

### Out of Scope

- non-6502 instruction-set extensions (see the exclusion list in the coverage matrix)
- object code generation and assembler-backend semantics


## Doc comments

A semicolon comment beginning exactly with `;! ` documents a label, equate, or macro. Hovering over a reference appends the documentation to its definition information.

Put a single doc comment at the end of the definition:

```asm
Entry nop ;! Program entry point.
Limit equ 10 ;! Maximum item count.
```

Or put one or more consecutive doc-comment-only lines immediately before the definition:

```asm
;! Writes one byte to output.
;! Preserves accumulator.
WriteByte
```

Blank lines, ordinary comments, and source lines end a preceding doc-comment block. Complete examples for both forms and all three symbol kinds live in [`examples/doc_comments.S`](examples/doc_comments.S).

## Implementation

- **runtime:** Node.js
- **language:** TypeScript
- **LSP library:** `vscode-languageserver`
- **process model:** standalone stdio server
- **development style:** TDD from the start

## Installation

### VS Code (Primary)
The VS Code extension lives in the `vscode/` folder. It bundles the Language Server automatically.
To package and install it locally:
```sh
cd vscode
npm install
npm run compile
npx vsce package
code --install-extension pearls-1.0.0.vsix
```

Once installed, the extension also contributes `Pearls: Compile Current File with Merlin32` and `Pearls: Assemble Project with Merlin32` commands. The project command uses `pearls.merlin32ProjectEntryFile` to choose a link script or entry source, then launches `merlin32 <macro-folder> <entry-file>` in an integrated terminal.

### Standalone Server (coc.nvim / Neovim)
If you are using Vim/Neovim or another LSP client, you can install the standalone server globally via npm:

```sh
npm install -g @razdolbai/merls
```

Set `initializationOptions.merlinMacroFolder` to a Merlin macro directory when launching the server. `USE 4/Int.Macs` resolves from that directory as `Int.Macs.s`: the legacy numeric prefix is ignored and `.s` is tried when no exact target exists.

## Development Workflow

- `npm install`: install project dependencies
- `npm run build`: compile the TypeScript sources into `dist/`
- `npm test`: lint, build, and run both language-server and VS Code extension test suites
- `npm run dev`: run the TypeScript compiler in watch mode during bootstrap work
- `pwsh test/smoke/run-smoke.ps1`: run the headless Vim + coc.nvim smoke test (requires Vim with coc.nvim installed via vim-plug)
- `cd vscode && npm test`: compile and run the VS Code extension unit tests

When developing the VS Code extension, open `vscode/` and press **F5**. Its launch task builds the root language server before starting the extension watcher, so the Extension Development Host uses the current server build.

The packaged CLI entry point now lives at `dist/src/cli.js`. For VS Code specific development, refer to `vscode/DEVELOPMENT.md`.

## CLI Contract

The supported stdio launch contract is `merls --stdio`.

## coc.nvim Target

The intended integration model is a standard `languageserver` entry in `coc-settings.json` that launches `merls` over stdio.

If you installed `merls` globally via npm, the `languageserver` shape is:

```json
{
  "semanticTokens.enable": true,
  "languageserver": {
    "merls": {
      "command": "merls",
      "args": [
        "--stdio"
      ],
      "rootPatterns": [
        ".git",
        "package.json"
      ],
      "filetypes": [
        "asm",
        "6502"
      ]
    }
  }
}
```

To enable semantic tokens for syntax highlighting, ensure `"semanticTokens.enable": true` is set in your `coc-settings.json` and that your Vim buffer uses a matching filetype — the canonical LSP language id is `6502`, while Vim's common `asm` filetype is also accepted (e.g. `set filetype=asm` or `set filetype=6502`).

An example configuration lives in `examples/coc-settings.json`.

`examples/EXAMPLE.S` is a diagnostics-free feature showcase users can open as a clean starter file — it includes the official-page forms (current address `*`, `1+2*3` vs `{1+2*3}` brace precedence, reassignable Merlin variables, semicolon-separated macro parameters, and `]0` argument count); `examples/DIAGNOSTICS.S` collects intentionally invalid syntax demonstrating every diagnostic category (`duplicate-symbol`, `unresolved-reference`, `duplicate-macro-definition`, `invalid-macro-local-label`, `unsupported-instruction`, `invalid-addressing-mode`, `unknown-syntax`, `missing-macro-end`), and `examples/doc_comments.S` shows both doc-comment forms.

## Development Notes

- TDD is mandatory for implementation work in this repository.
- Core syntax, parsing, and document model logic are located in `src/asm/`.
- `src/asm/expression.ts` recognizes Merlin's current-address `*` expression atom.
- Merlin expressions evaluate left-to-right by default; braces (`{...}`) enable algebraic operator precedence.
- Comparison (`<`, `=`, `>`, `#`) and logical (`&`, `.`, `!`) expressions preserve Merlin syntax, prefix byte selectors, and immediate operands.
- Binary literals accept `_` digit separators, including `%0000_1111_0000_1111`.
- `]name = expression` declares a reassignable Merlin variable: it is distinct from anchor-scoped local labels, resolves across reassignments, and requires definition before use.
- Macro call arguments use adjacent semicolons (`Move #$00;$02`); a semicolon preceded by whitespace remains a trailing comment.
- Macro parameter splitting is shared by expansion, diagnostics, signature help, and navigation; commas remain part of a macro argument, including indexed operands.
- Macro placeholder `]0` expands to the supplied argument count, allowing flexible macros to accept zero, one, or eight arguments without arity diagnostics.
- Alternate macro-call forms `PMC name,args` and `>>> name,args` parse into the same macro-call model as direct calls, so expansion, arity and forward-call diagnostics, hover, semantic tokens, navigation, and rename all apply identically.
- LSP handlers (hover, completion, diagnostics, etc.) are located in `src/lsp/`.
- The CLI entry point lives in `src/cli.ts` and compiles to `dist/src/cli.js`.
- The VS Code extension contributes `Pearls: Compile Current File with Merlin32` and `Pearls: Assemble Project with Merlin32` commands and exposes `pearls.merlin32Executable`, `pearls.compileArgs`, `pearls.merlin32MacroFolder`, and `pearls.merlin32ProjectEntryFile` settings for assembler invocation. Assembled terminal commands quote arguments so paths containing shell metacharacters cannot break or inject into the command.
- When the Pearls extension is active for the `6502` language in Visual Studio Code, it sets the language-scoped defaults `editor.tabSize = 8` and `editor.indentSize = 8`, and the extension also reapplies `tabSize = 8` to visible `6502` editors at runtime.
- The Pearls extension enables `editor.quickSuggestions` for the `6502` language so completions appear while typing.
- The `test/fixtures/valid/` directory contains supported 6502 Merlin32-style syntax samples, including dedicated macro-coverage fixtures for nested calls, zero-argument macros, local labels, and conditional assembly forms, plus an official-page transcription covering current address `*`, brace precedence, Merlin variables, semicolon-separated macro parameters, `]0`, nested macro definitions, and implicit `.s` include suffixes; the fixture corpus test asserts that every valid fixture parses without errors and produces zero diagnostics.
- The `test/fixtures/invalid/` directory contains unknown-syntax negative samples plus negative macro fixtures such as macro-generated unresolved references; the fixture corpus test asserts the exact expected diagnostic-code sequence for every invalid fixture instead of accepting any nonempty provenance marker.
- Parser tests lock down macro-call parsing and `mac`/`eom`/`<<<` terminator behavior, including nested macro definitions.
- The parser exposes first-class macro definition regions, including body lines, closing directives, nested definitions scoped to their enclosing macro, positional parameter placeholders, nested macro calls, symbol references, and invalid macro-local label definitions/references for diagnostics, via `src/asm/parser.ts`.
- The document model now exposes explicit macro definition and macro call structures, including structured macro body usage metadata for parameter references, nested calls, symbol references, and invalid macro-local labels, via `src/asm/document.ts`.
- String payloads preserve every character when the closing quote is missing: the expression parser strips the closing quote only when present, so an unterminated `ASC` string keeps its full text instead of dropping the last character.
- The macro index lives in `src/asm/macros.ts` and collects top-level per-document and per-workspace macro definitions, body ranges, positional arity, referenced symbols, nested macro calls, and invalid macro-local label usage; nested definitions remain scoped to their parent regions.
- The symbol index in `src/asm/symbols.ts` now uses one shared record shape for labels, equates, data definitions, and macros, including token locations and attached macro-definition metadata for macro symbols.
- Signature help in `src/lsp/signature-help.ts` now derives macro parameter counts from the parsed macro index rather than rescanning macro body text with regexes.
- Signature-help coverage now explicitly includes zero-argument macros, multi-digit positional parameters, nested expressions, and comma handling that only advances the active parameter at top-level argument boundaries.
- Diagnostics in `src/asm/diagnostics.ts` emit macro-specific failures for unsupported-instruction-or-undefined-macro call sites, duplicate macro definitions, missing `eom`/`<<<` terminators, and straightforward arity mismatches.
- Diagnostics resolve numeric and previously defined `EQU`/variable values in `DO` and `IF` conditions; inactive `ELSE` branches are excluded from unresolved-reference and duplicate-symbol checks, while unknown conditions retain both branches for diagnostics.
- Macro calls and `EQU` references must resolve to a definition earlier in workspace load order; `forward-macro-call` and `forward-equate-reference` diagnostics preserve ordinary forward-label references.
- Unresolved-reference analysis and syntax validation now treat `HEX` directive payloads as raw hexadecimal data rather than symbol names: groups must contain only `0-9A-F` digits, each group must have an even number of digits, groups may be adjacent or comma-separated, and the usual `$` prefix omission applies only inside `HEX`.
- Macro diagnostics now carry stable token-based character ranges for macro-definition and macro-call failures, and the LSP diagnostic bridge preserves those narrower spans instead of always highlighting whole lines.
- Diagnostics for macro-expanded lines clamp columns to the original source line: argument-derived references map through the call-site token, body-derived failures stay on the macro body line only, and `getUnknownTextPattern` can no longer emit negative columns. `jmp (abs,x)` is accepted as valid 65C02 indirect-X addressing.
- LSP diagnostic collection deduplicates URI aliases by normalized file path and always reports through the open document URI, preventing same-line duplicate-symbol errors from cache aliases.
- Macro argument substitution lives in `expandMacroCall` in `src/asm/expansion.ts`, mapping call arguments onto the `]n` placeholders they satisfy inside parsed macro bodies; argument splitting, arity checking, and signature-help parameter tracking all share the one `forEachMacroArgumentToken` separator walker exported from the same module.
- Expansion tests cover parenthesized argument expressions, separator-delimited arguments, argument-to-call-site token mapping, cached re-expansion behavior, and bounded branching chains.
- Reference collection in `src/lsp/symbol-navigation.ts` now attributes macro-expanded symbol uses back to the concrete argument tokens at the macro call site instead of only reporting the macro name token itself, and expanded ranges use the `callSiteToken` mapping so references and rename edits land on the correct call-site columns.
- Macro-aware definition/reference coverage now includes call-site symbol resolution through nested macro calls, ensuring navigation lands on the concrete symbol definition supplied to the macro rather than on the macro symbol itself.
- Rename planning now propagates through macro-expanded call-site symbol references, so renaming a concrete symbol updates both its definition and the macro call arguments that expand to that symbol.
- Rename coverage now includes nested macro-call expansion paths, ensuring the propagated edit set still targets only the concrete symbol definition and call-site argument tokens rather than macro placeholders.
- Rename rejects cross-scope targets: macro parameter placeholders (`]1`-style) and `:local`/`]local` labels fail with a descriptive error, and the new name must be a valid Merlin identifier. Renaming a Merlin variable preserves its `]` prefix.
- Local-label resolution is limited to ordinary Merlin anchor-based locals; local labels inside macros are rejected to match Merlin32 behavior.
- Completion items replace the active token explicitly, so accepting `]local` or `:loop` after typing its prefix does not duplicate the prefix.
- Completion is triggered automatically while typing Merlin identifier characters, including the `]` and `:` prefixes of local labels, and is suppressed whenever the cursor sits on any character of a comment or string token, including its first character.
- Macro-body completion offers only documented positional placeholders: `]0` and `]1` through `]8`.
- Local-label completion candidates are limited to the current global-label anchor, and backward `]label` candidates must already be defined.
- Local-label tests now also cover that macro-local labels remain unresolved while ordinary Merlin anchor-based locals before or after a macro call still resolve normally.
- Hover now recognizes macro call sites directly, showing parsed positional signatures and macro definition lines instead of only falling back to generic symbol hover text.
- Caching and invalidation rules for macro indexes and expansion-analysis results ensure that open-document updates do not unnecessarily re-expand the entire workspace.
- The workspace index cache is invalidated both before and after watched-file updates, so a request that races the asynchronous disk reload cannot retain a stale empty index.
- Workspace index merges skip disk-cache entries whose lowercased path is already indexed and never overwrite open-document keys, so unsaved buffers keep precedence over stale disk content and case-mismatched paths do not produce duplicate entries on Windows.
- URI-to-path conversion has one canonical helper, `uriToFilePath` in `src/lsp/uri.ts`, shared by the server index and LSP diagnostics; it lowercases file paths on win32 so case-mismatched URIs never produce duplicate index entries.
- The local-label resolver exports one shared `isLocalLabel` predicate used by diagnostics, completion, semantic tokens, code lens, selection ranges, navigation, and rename instead of divergent inline copies.
- One shared `getGlobalLabelToken` walker replaces the four divergent global-label shape walkers; diagnostics, selection ranges, and call hierarchy all resolve the global label token through it.
- Identifier collection across navigation, diagnostics, local-label resolution, and macro usage tracking shares one `walkExpression` traversal in `src/asm/expression.ts` instead of four recursive copies.
- Merlin `ASL`, `LSR`, `ROL`, and `ROR` use implied accumulator syntax; explicit `A` operands remain identifiers and produce normal diagnostics.
- Addressing diagnostics select direct-page or absolute modes from resolvable operand values; `STA $00,Y` is rejected unless a `:` mnemonic suffix forces absolute syntax, such as `LDA: $11`.
- `BGE` and `BLT` are documented relative-branch aliases for `BCS` and `BCC`; completion and hover expose their carry-condition meaning.
- `ADR`, `ADRL`, `PUTBIN`, `CHK`, `DAT`, and `REL` preserve directive payloads for editor parsing. This 6502-only server does not assemble 65816 long-address, relocation, checksum, or binary-embedding semantics.
- Multi-value data/storage operands validate precisely: `DS count,fill` accepts at most two operands (with `DS \,fill` continuing the previous reservation), empty `ASC` segments fail with `invalid-data-operand`, and mixed string/numeric `ASC` payloads like `ASC "AB",$8D,"CD"` resolve through the shared data-line model. `INV` and `FLS` string payloads reject lowercase characters with a targeted `invalid-data-operand` diagnostic instead of silently advertising them as valid inverse or flashing text.
- `LUP … --^` repeat regions parse into a `loopRegions` model with nested delimiter matching and no object-code generation. Unmatched terminators (`unmatched-loop-terminator`), unterminated regions (`unterminated-loop`), and generated `@` labels or references (`unsupported-generated-label`) receive precise diagnostic codes, while loop-body Merlin variables keep resolving through the reassignable `]name` substitution model.
- Location and reference deduplication shares one generic `uniqueLocations` helper in `src/lsp/symbol-navigation.ts` instead of four `JSON.stringify`-keyed Map copies.
- Macro parameter placeholder detection shares one `macroParameterPattern` regex in `src/asm/macros.ts` across the parser, expansion, diagnostics, navigation, rename, and semantic tokens.
- Workspace include lookups compare paths case-insensitively on win32, so includes spelled with different drive or letter case resolve to open buffers and cached documents instead of stale disk content.
- Include handling shares `includeDirectives` and one `readIncludeTarget` reader in `src/asm/workspace.ts` between workspace indexing and document links, so both resolve identifier, string, numeric, and concatenated include operands the same way.
- Workspace `USE` resolution accepts `initializationOptions.merlinMacroFolder`, strips the legacy leading numeric subfolder, and tries an implicit `.s` suffix while preserving open-buffer and disk-cache precedence.
- A valid `END` directive terminates source indexing and diagnostics; labels, includes, macros, and unresolved references after it are intentionally ignored.
- Untitled editor documents remain indexable but do not resolve `asm`/`put`/`use` dependencies, preventing virtual URI names from producing invalid disk paths.
- Diagnostic notifications swallow transport rejections through `sendDiagnosticsSafely`, so a disposed client cannot surface unhandled promise rejections, and the disk cache evicts paths unreachable from any open document's include graph after watched-file updates and document closes.
- LSP feature handlers share one input shape (open-document map plus request URI) and every array result returns `[]` for unknown documents instead of `null`, so document highlights and selection ranges match their peers.
- Inlay hints resolve duplicate equ names deterministically: the first definition in workspace load order wins, matching duplicate-symbol diagnostics.
- Performance tests and regression benchmarks validate that navigation and diagnostics remain responsive even for heavily macro-expanded fixture files.
- Guardrails catch and diagnose unresolvable or ambiguous cases: recursion (`macro-recursion`), deep nesting and branching expansion (`deep-macro-expansion`), token-pasted/generated names (`token-pasted-name`), and conditionals (`unresolved-conditional`), failing predictably without returning incorrect results. `MAX_MACRO_EXPANSION_DEPTH` and `MAX_MACRO_EXPANSION_LINES` in `src/asm/limits.ts` keep the diagnostic and expansion guards aligned: each call site stops expanding after the total line budget and reports one `deep-macro-expansion` diagnostic.
- Auto-formatting now uppercases known instructions and directives while preserving labels, macro-call identifiers, and operand text as written.
- The integration test suite covers stdio `initialize`, the CLI contract, and core LSP features.
- Integration tests share `test/helpers/json-rpc-client.ts`, which frames stdio messages, rejects requests when the server exits or errors, and enforces request deadlines so a failed server cannot stall the suite indefinitely.
