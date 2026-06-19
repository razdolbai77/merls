import { type Hover } from "vscode-languageserver/node";

import { directiveTable, opcodeTable } from "../asm/metadata";
import { parseDocument } from "../asm/document";
import { lexSource, type Token } from "../asm/lexer";
import { findDefinition } from "./symbol-navigation";

export function buildHover(
  openDocuments: ReadonlyMap<string, string>,
  uri: string,
  line: number,
  character: number
): Hover | null {
  const source = openDocuments.get(uri);
  if (source === undefined) {
    return null;
  }

  const documentLine = parseDocument(source).lines[line];
  const lexedLine = lexSource(source).lines[line];
  if (documentLine === undefined || lexedLine === undefined) {
    return null;
  }

  const token = tokenAtCharacter(lexedLine.tokens, character);
  if (token?.kind === "mnemonic") {
    const definition = opcodeTable.get(token.lexeme.toLowerCase());
    if (definition !== undefined) {
      return {
        contents: `Opcode ${definition.mnemonic}: ${definition.modes.join(", ")}`
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

    const definition = findDefinition(openDocuments, uri, line);
    if (definition !== null) {
      return {
        contents: `Symbol ${token.lexeme} defined at line ${definition.range.start.line}`
      };
    }
  }

  const node = documentLine.node;
  if (node.shape === "instruction") {
    const definition = opcodeTable.get(node.mnemonic);
    if (definition !== undefined) {
      return {
        contents: `Opcode ${definition.mnemonic}: ${definition.modes.join(", ")}`
      };
    }
  }

  if (node.shape === "directive") {
    const definition = directiveTable.get(node.directive);
    if (definition !== undefined) {
      return {
        contents: `Directive ${definition.name}: ${definition.summary}`
      };
    }
  }

  return null;
}

function tokenAtCharacter(tokens: readonly Token[], character: number): Token | null {
  for (const token of tokens) {
    if (character >= token.start && character < token.end) {
      return token;
    }
  }

  return null;
}
