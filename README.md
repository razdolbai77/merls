# merls

`merls` is a powerful Language Server for **Merlin32-style 6502 assembly**. It provides a rich set of intelligent IDE features and includes a fully-fledged **Visual Studio Code extension** as well as a standalone server published to npm (e.g., for **coc.nvim**).

## Status

The LSP feature set for Merlin32-style 6502 assembly is comprehensive and fully implemented. The repository now includes:
1. A standalone Language Server (`@razdolbai/merls`) published to npm for use with Neovim/Vim.
2. A bundled VS Code Extension (in the `vscode/` directory) for a plug-and-play graphical editor experience.

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

- non-6502 instruction-set extensions


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
        ".git"
      ],
      "filetypes": [
        "6502"
      ]
    }
  }
}
```

To enable semantic tokens for syntax highlighting, ensure `"semanticTokens.enable": true` is set in your `coc-settings.json` and that your Vim buffer is set to the matching filetype (e.g. `set filetype=6502`).

An example configuration lives in `examples/coc-settings.json`.

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
- LSP handlers (hover, completion, diagnostics, etc.) are located in `src/lsp/`.
- The CLI entry point lives in `src/cli.ts` and compiles to `dist/src/cli.js`.
- The VS Code extension contributes `Pearls: Compile Current File with Merlin32` and `Pearls: Assemble Project with Merlin32` commands and exposes `pearls.merlin32Executable`, `pearls.compileArgs`, `pearls.merlin32MacroFolder`, and `pearls.merlin32ProjectEntryFile` settings for assembler invocation.
- When the Pearls extension is active for the `6502` language in Visual Studio Code, it sets the language-scoped defaults `editor.tabSize = 8` and `editor.indentSize = 8`, and the extension also reapplies `tabSize = 8` to visible `6502` editors at runtime.
- The Pearls extension enables `editor.quickSuggestions` for the `6502` language so completions appear while typing.
- The `test/fixtures/valid/` directory contains supported 6502 Merlin32-style syntax samples, including dedicated macro-coverage fixtures for nested calls, zero-argument macros, local labels, and conditional assembly forms.
- The `test/fixtures/invalid/` directory contains unknown-syntax negative samples plus negative macro fixtures such as macro-generated unresolved references.
- Parser tests now explicitly lock down current macro-call parsing and the existing `mac`/`eom`/`<<<` line behavior before macro-structure refactors.
- The parser now exposes first-class macro definition regions, including body lines, closing directives, positional parameter placeholders, nested macro calls, symbol references, and invalid macro-local label definitions/references for diagnostics, via `src/asm/parser.ts`; illegal nested `mac` definitions remain diagnostic-only and are excluded from macro navigation/indexing.
- The document model now exposes explicit macro definition and macro call structures, including structured macro body usage metadata for parameter references, nested calls, symbol references, and invalid macro-local labels, via `src/asm/document.ts`.
- The macro index now lives in `src/asm/macros.ts` and collects per-document and per-workspace macro definitions, body ranges, positional arity, referenced symbols, nested macro calls, and invalid macro-local label usage.
- The symbol index in `src/asm/symbols.ts` now uses one shared record shape for labels, equates, data definitions, and macros, including token locations and attached macro-definition metadata for macro symbols.
- Signature help in `src/lsp/signature-help.ts` now derives macro parameter counts from the parsed macro index rather than rescanning macro body text with regexes.
- Signature-help coverage now explicitly includes zero-argument macros, multi-digit positional parameters, nested expressions, and comma handling that only advances the active parameter at top-level argument boundaries.
- Diagnostics in `src/asm/diagnostics.ts` now emit macro-specific failures for unsupported-instruction-or-undefined-macro call sites, duplicate macro definitions, missing `eom`/`<<<` terminators, illegal nested macro definitions, and straightforward arity mismatches.
- Unresolved-reference analysis and syntax validation now treat `HEX` directive payloads as raw hexadecimal data rather than symbol names: groups must contain only `0-9A-F` digits, each group must have an even number of digits, groups may be adjacent or comma-separated, and the usual `$` prefix omission applies only inside `HEX`.
- Macro diagnostics now carry stable token-based character ranges for macro-definition and macro-call failures, and the LSP diagnostic bridge preserves those narrower spans instead of always highlighting whole lines.
- LSP diagnostic collection deduplicates URI aliases by normalized file path and always reports through the open document URI, preventing same-line duplicate-symbol errors from cache aliases.
- The initial parameter-substitution model now lives in `src/asm/substitution.ts`, mapping macro call arguments onto the `]n` placeholders they satisfy inside parsed macro bodies and collecting symbol references from each supplied argument expression.
- Substitution tests now cover repeated placeholder use, unused trailing arguments, parenthesized argument expressions, and arguments that reference multiple concrete symbols.
- Reference collection in `src/lsp/symbol-navigation.ts` now attributes macro-expanded symbol uses back to the concrete argument tokens at the macro call site instead of only reporting the macro name token itself.
- Macro-aware definition/reference coverage now includes call-site symbol resolution through nested macro calls, ensuring navigation lands on the concrete symbol definition supplied to the macro rather than on the macro symbol itself.
- Rename planning now propagates through macro-expanded call-site symbol references, so renaming a concrete symbol updates both its definition and the macro call arguments that expand to that symbol.
- Rename coverage now includes nested macro-call expansion paths, ensuring the propagated edit set still targets only the concrete symbol definition and call-site argument tokens rather than macro placeholders.
- Local-label resolution is limited to ordinary Merlin anchor-based locals; local labels inside macros are rejected to match Merlin32 behavior.
- Completion items replace the active token explicitly, so accepting `]local` or `:loop` after typing its prefix does not duplicate the prefix.
- Completion is triggered automatically while typing Merlin identifier characters, including the `]` and `:` prefixes of local labels.
- Local-label completion candidates are limited to the current global-label anchor, and backward `]label` candidates must already be defined.
- Local-label tests now also cover that macro-local labels remain unresolved while ordinary Merlin anchor-based locals before or after a macro call still resolve normally.
- Hover now recognizes macro call sites directly, showing parsed positional signatures and macro definition lines instead of only falling back to generic symbol hover text.
- Caching and invalidation rules for macro indexes and expansion-analysis results ensure that open-document updates do not unnecessarily re-expand the entire workspace.
- The workspace index cache is invalidated both before and after watched-file updates, so a request that races the asynchronous disk reload cannot retain a stale empty index.
- Performance tests and regression benchmarks validate that navigation and diagnostics remain responsive even for heavily macro-expanded fixture files.
- Guardrails catch and diagnose unresolvable or ambiguous cases: recursion (`macro-recursion`), deep nesting (`deep-macro-expansion`), token-pasted/generated names (`token-pasted-name`), and conditionals (`unresolved-conditional`), failing predictably without returning incorrect results. `MAX_MACRO_EXPANSION_DEPTH` in `src/asm/limits.ts` keeps the diagnostic and expansion guards aligned.
- Auto-formatting now uppercases known instructions and directives while preserving labels, macro-call identifiers, and operand text as written.
- The integration test suite covers stdio `initialize`, the CLI contract, and core LSP features.
- Integration tests share `test/helpers/json-rpc-client.ts`, which frames stdio messages, rejects requests when the server exits or errors, and enforces request deadlines so a failed server cannot stall the suite indefinitely.
