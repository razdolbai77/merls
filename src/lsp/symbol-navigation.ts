import { type Location } from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { type Expression } from "../asm/expression";
import { type ParsedLine } from "../asm/parser";
import { type Token, tokenAtCharacter } from "../asm/lexer";

type SymbolDefinition = {
  name: string;
  location: Location;
};

type SymbolReference = {
  name: string;
  location: Location;
};

export function findDefinition(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number
): Location | null {
  const targetName = getSymbolAtPosition(openDocuments.get(uri), line, character);
  if (targetName === null) {
    return null;
  }

  for (const [documentUri, cached] of openDocuments.entries()) {
    for (const definition of collectDefinitions(documentUri, cached)) {
      if (definition.name === targetName) {
        return definition.location;
      }
    }
  }

  return null;
}

export function findReferences(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number,
  includeDeclaration: boolean
): Location[] {
  const targetName = getSymbolAtPosition(openDocuments.get(uri), line, character);
  if (targetName === null) {
    return [];
  }

  const locations: Location[] = [];

  for (const [documentUri, cached] of openDocuments.entries()) {
    if (includeDeclaration) {
      for (const definition of collectDefinitions(documentUri, cached)) {
        if (definition.name === targetName) {
          locations.push(definition.location);
        }
      }
    }

    for (const reference of collectReferences(documentUri, cached)) {
      if (reference.name === targetName) {
        locations.push(reference.location);
      }
    }
  }

  return locations;
}

export function getSymbolAtPosition(cached: CachedDocument | undefined, line: number, character: number): string | null {
  if (cached === undefined) {
    return null;
  }

  const lexedLine = cached.lexed.lines[line];
  if (lexedLine === undefined) {
    return null;
  }

  const token = tokenAtCharacter(lexedLine.tokens, character);
  if (token?.kind === "identifier" || token?.kind === "label" || token?.kind === "localLabel") {
    return token.lexeme;
  }

  return null;
}

export function collectDefinitions(uri: string, cached: CachedDocument): readonly SymbolDefinition[] {
  const definitions: SymbolDefinition[] = [];

  for (const line of cached.parsed.lines) {
    const token = getDefinedLabelToken(line.node);
    if (token === null) {
      continue;
    }

    definitions.push({
      name: token.lexeme,
      location: {
        uri,
        range: {
          start: { line: line.line, character: token.start },
          end: { line: line.line, character: token.end }
        }
      }
    });
  }

  return definitions;
}

export function collectReferences(uri: string, cached: CachedDocument): readonly SymbolReference[] {
  const references: SymbolReference[] = [];

  for (const line of cached.parsed.lines) {
    const tokens = getReferencedTokens(line.node);

    for (const token of tokens) {
      references.push({
        name: token.lexeme,
        location: {
          uri,
          range: {
            start: { line: line.line, character: token.start },
            end: { line: line.line, character: token.end }
          }
        }
      });
    }
  }

  return references;
}

function getDefinedLabelToken(node: ParsedLine): Token | null {
  if (node.shape === "equate") {
    return node.label;
  }

  if (node.shape === "labelOnly") {
    return node.label;
  }

  if (node.shape === "instruction" && node.label !== null) {
    return node.label;
  }

  if (node.shape === "directive" && node.label !== null) {
    return node.label;
  }

  if (node.shape === "data" && node.label !== null) {
    return node.label;
  }

  return null;
}

function getReferencedTokens(node: ParsedLine): readonly Token[] {
  if (node.shape === "instruction" && node.operand !== null) {
    return collectExpressionIdentifiers(node.operand.expression);
  }

  if (node.shape === "directive" && node.operand !== null) {
    return collectExpressionIdentifiers(node.operand);
  }

  if (node.shape === "equate") {
    return collectExpressionIdentifiers(node.expression);
  }

  if (node.shape === "macroCall") {
    return [node.macro];
  }

  return [];
}

function collectExpressionIdentifiers(expression: Expression): readonly Token[] {
  switch (expression.kind) {
    case "identifier":
      return [expression.token];
    case "modifier":
      return collectExpressionIdentifiers(expression.expression);
    case "unary":
      return collectExpressionIdentifiers(expression.expression);
    case "binary":
      return [
        ...collectExpressionIdentifiers(expression.left),
        ...collectExpressionIdentifiers(expression.right)
      ];
    default:
      return [];
  }
}
