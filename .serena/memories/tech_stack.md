- Node.js runtime, TypeScript implementation, \scode-languageserver\ for LSP.
- Server model: standalone process over stdio; coc.nvim launches it via standard \languageserver\ config.
- Workspace shape: \src/\ for implementation, \	est/\ for automated tests, \xamples/\ for coc.nvim config/examples, dedicated fixture directories for assembly corpora.
- Built via \
pm run build\ and tested via \
pm test\.