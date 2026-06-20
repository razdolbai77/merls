# Future LSP Features Plan

## Highly Valuable for Assembly
- [x] **Formatting (`documentFormattingProvider`)**: Auto-format assembly code (aligning labels, mnemonics, operands).
- [x] **Rename (`renameProvider`)**: Safely rename global labels, local labels, or equates across the workspace.
- [x] **Folding Ranges (`foldingRangeProvider`)**: Collapse macro definitions, large data blocks, or multiline comments.
- [x] **Document Links (`documentLinkProvider`)**: Make `put` and `use` file references directly clickable.

## Nice-to-Have / Advanced
- [x] **Document Highlights (`documentHighlightProvider`)**: Highlight all read/write occurrences of a symbol in the current document.
- [x] **Inlay Hints (`inlayHintProvider`)**: Render computed values of equates or CPU cycle counts for instructions inline.
- [x] **Signature Help (`signatureHelpProvider`)**: Show parameter hints when invoking macros.
- [x] **Call Hierarchy (`callHierarchyProvider`)**: Build a call tree by analyzing `JSR` and `JMP` instructions.
- [x] **Code Actions (`codeActionProvider`)**: Provide Quick Fixes, such as suggesting 6502 alternatives for 65816 instructions.
