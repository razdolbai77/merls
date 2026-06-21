# Pearls: 6502 Assembly Language Server

Pearls is a fast, robust, and fully-featured Language Server (LSP) and extension for developing 6502 Assembly in Visual Studio Code. It is specifically tailored for Merlin32/6502 syntax and designed to provide a modern, intelligent IDE experience for retro-programming.

## Features

- **Intelligent Semantic Highlighting**: Goes beyond basic regex. Pearls parses your entire workspace and highlights resolved local labels, global labels, directives, and operands with rich, context-aware colors.
- **Hover Hints & Documentation**: Hover over any mnemonic (like `LDA` or `ADC`) or pseudo-directive (like `DSK` or `ORG`) to instantly see its syntax, addressing modes, and documentation.
- **Go to Definition**: Instantly jump to the exact file and line where a label, variable, or macro was defined.
- **Find All References**: See everywhere a specific label or memory address is used across your entire project.
- **Code Lenses**: See inline reference counts for your subroutines and data blocks right above the code.
- **Workspace Navigation**: Press `Ctrl+T` (or `Cmd+T`) to search for any symbol, equate, or macro anywhere in your workspace.
- **Automatic Diagnostics**: Get instant squiggly lines for malformed syntax, unresolved references, and duplicate labels as you type.

## Supported Syntax

Pearls is highly optimized for the **Merlin32** macro assembler syntax, including:
- Standard 6502 mnemonics
- Merlin32 pseudo-directives (`ORG`, `EQU`, `DSK`, `MAC`, `DO`, `IF`, etc.)
- Global and local labels (e.g., `]loop`, `:branch`)
- Hex (`$FF`), Decimal (`255`), and Binary (`%11111111`) literals

## Getting Started

1. Install the extension.
2. Open any `.s`, `.S`, or `.asm` file.
3. The Pearls Language Server will automatically boot in the background and begin indexing your project.

### Semantic Highlighting Note
To get the most out of Pearls' intelligent colorization, ensure you have Semantic Highlighting enabled in your VS Code settings:
```json
{
  "editor.semanticHighlighting.enabled": true
}
```
*(Note: Pearls includes custom color overrides so your code will look beautiful regardless of your currently active theme!)*

## Contributing

For instructions on building the extension from source, running the test suite, or contributing to the language server, please see `DEVELOPMENT.md`.
