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
- **Compile Current File Command**: Run `Pearls: Compile Current File with Merlin32` to save the active source file and invoke `merlin32 <macro-folder> <current-file>` in VS Code's integrated terminal.
- **Project Assemble Command**: Run `Pearls: Assemble Project with Merlin32` to invoke `merlin32 <macro-folder> <entry-file>` using a configured project entry file or link script.

## Requirements

- Visual Studio Code 1.91 or newer.

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
4. Run **Pearls: Compile Current File with Merlin32** from the Command Palette, editor title, or editor context menu to assemble the active file.
5. Run **Pearls: Assemble Project with Merlin32** to assemble the configured project entry file or link script.

### Merlin32 Compile Command
The compile command runs `merlin32 <macro-folder> <current-file>` from VS Code's integrated terminal. The macro folder argument comes from `pearls.merlin32MacroFolder` when set, otherwise Pearls uses the current file's directory. You can customize the invocation in VS Code settings:
```json
{
  "pearls.merlin32Executable": "merlin32",
  "pearls.compileArgs": [],
  "pearls.merlin32MacroFolder": ""
}
```

For project builds, configure an entry file or link script relative to the workspace root:
```json
{
  "pearls.merlin32ProjectEntryFile": "build/main.S"
}
```

`Pearls: Assemble Project with Merlin32` resolves that path against the workspace folder unless you provide an absolute path.

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
