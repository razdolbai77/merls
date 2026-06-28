import { type Hover } from "vscode-languageserver/node";

import { directiveTable, opcodeTable } from "../asm/metadata";
import { type CachedDocument } from "../asm/document";
import { tokenAtCharacter } from "../asm/lexer";
import { findDefinition } from "./symbol-navigation";
import { findSymbol } from "../asm/symbols";

export function buildHover(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number
): Hover | null {
  const cached = openDocuments.get(uri);
  if (cached === undefined) {
    return null;
  }

  const documentLine = cached.parsed.lines[line];
  const lexedLine = cached.lexed.lines[line];
  if (documentLine === undefined || lexedLine === undefined) {
    return null;
  }

  const token = tokenAtCharacter(lexedLine.tokens, character);
  if (token?.kind === "mnemonic") {
    const definition = opcodeTable.get(token.lexeme.toLowerCase());
    if (definition !== undefined) {
      return {
        contents: `Opcode ${definition.mnemonic}: ${definition.description}\n\nModes: ${definition.modes.join(", ")}`
      };
    }
  }

  if (token?.kind === "directive") {
    const definition = directiveTable.get(token.lexeme.toLowerCase());
    if (definition !== undefined) {
      return {
        contents: `Directive ${definition.name}: ${definition.summary}`
      };
    }
  }

  if (token?.kind === "identifier" || token?.kind === "label" || token?.kind === "localLabel") {
    const lexemeLower = token.lexeme.toLowerCase();
    if (lexemeLower === "a" || lexemeLower === "x" || lexemeLower === "y") {
      return {
        contents: `Register ${token.lexeme.toUpperCase()}`
      };
    }

    if ("label" in documentLine.node && documentLine.node.label?.start === token.start) {
      return null;
    }

    if (documentLine.node.shape === "macroCall" && documentLine.node.macro.start === token.start) {
      const macroSymbol = findSymbol(openDocuments, token.lexeme, "macro");
      if (macroSymbol !== null) {
        const maxParam = macroSymbol.symbol.macroDefinition?.maxParameterIndex ?? 0;
        const signature = maxParam === 0
          ? `${token.lexeme}()`
          : `${token.lexeme}(${Array.from({ length: maxParam }, (_, index) => `]${index + 1}`).join(", ")})`;
        return {
          contents: `Macro ${signature} defined at line ${macroSymbol.symbol.line + 1}`
        };
      }
    }

    const definitions = findDefinition(openDocuments, uri, line, token.start);
    if (definitions !== null) {
      const definition = Array.isArray(definitions) ? definitions[0] : definitions;
      if (definition !== undefined) {
        if (definition.uri !== uri) {
          const filename = definition.uri.split("/").pop();
          return {
            contents: `Symbol ${token.lexeme} defined in ${filename} at line ${definition.range.start.line + 1}`
          };
        }
        return {
          contents: `Symbol ${token.lexeme} defined at line ${definition.range.start.line + 1}`
        };
      }
    }
  }

  const node = documentLine.node;
  if (node.shape === "instruction") {
    const definition = opcodeTable.get(node.mnemonic.lexeme.toLowerCase());
    if (definition !== undefined) {
      return {
        contents: `Opcode ${definition.mnemonic}: ${definition.description}\n\nModes: ${definition.modes.join(", ")}`
      };
    }
  }

  if (node.shape === "directive") {
    const definition = directiveTable.get(node.directive.lexeme.toLowerCase());
    if (definition !== undefined) {
      return {
        contents: `Directive ${definition.name}: ${definition.summary}`
      };
    }
  }

  return null;
}
