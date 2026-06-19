# Semantic Tokens Implementation Plan

This plan outlines the steps to implement LSP Semantic Tokens for highlighting Merlin-style 6502 assembly.

- [x] 1. **Define Semantic Token Legend**: Determine mapping between `merls` lexer/parser tokens and standard LSP semantic token types (e.g., `keyword` for opcodes/directives, `comment`, `number`, `string`, `variable` for labels).
- [x] 2. **Advertise Server Capability**: Update `src/server.ts` to return `semanticTokensProvider` in the `initialize` response, supplying the token legend and enabling full-document token requests.
- [x] 3. **Implement Token Builder Logic**: Create `src/lsp/semantic-tokens.ts` and implement a function that takes a parsed document, iterates over its tokens (handling lines, comments, strings, instructions), and feeds them into the `SemanticTokensBuilder` provided by `vscode-languageserver`.
- [x] 4. **Register Request Handler**: In `src/server.ts`, register `connection.languages.semanticTokens.on(..)` and wire it to the token builder logic so it processes the requested document URI.
- [x] 5. **Write Integration Tests**: Add a test case in the existing test suite that mocks a `textDocument/semanticTokens/full` request and validates that the encoded integer array correctly represents the tokens of a fixture `.asm` file.
- [x] 6. **Manual Verification**: Run `pwsh test/smoke/run-smoke.ps1` (or test with the global `merls` install in `coc.nvim`) to verify that the syntax highlighting appears correctly inside the editor.
