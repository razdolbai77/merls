import { type Hover } from "vscode-languageserver/node";

import { directiveTable, opcodeTable } from "../asm/metadata";
import { type CachedDocument } from "../asm/document";
import { type Token, tokenAtCharacter } from "../asm/lexer";
import { findDefinition } from "./symbol-navigation";

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

    const definition = findDefinition(openDocuments, uri, line, token.start);
    if (definition !== null) {
      return {
        contents: `Symbol ${token.lexeme} defined at line ${definition.range.start.line}`
      };
    }
  }

  const node = documentLine.node;
  if (node.shape === "instruction") {
    const definition = opcodeTable.get(node.mnemonic.lexeme.toLowerCase());
    if (definition !== undefined) {
      return {
        contents: `Opcode ${definition.mnemonic}: ${definition.modes.join(", ")}`
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
