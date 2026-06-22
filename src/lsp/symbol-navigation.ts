import { type Location } from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { type Expression } from "../asm/expression";
import { type ParsedLine } from "../asm/parser";
import { type Token, tokenAtCharacter } from "../asm/lexer";
import { collectSymbols } from "../asm/symbols";
import { buildMacroSubstitution } from "../asm/substitution";

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
): Location | Location[] | null {
  const cached = openDocuments.get(uri);
  const targetName = getSymbolAtPosition(cached, line, character);
  if (targetName === null) {
    return null;
  }

  const parameterMatch = /^\](\d+)$/u.exec(targetName);
  if (parameterMatch !== null && cached !== undefined) {
    const parameterIndex = Number.parseInt(parameterMatch[1] ?? "0", 10);
    const enclosingMacro = cached.parsed.macroDefinitions.find(
      (def) => line > def.startLine && (def.endLine === null || line < def.endLine)
    );

    if (enclosingMacro !== undefined) {
      const locations: Location[] = [];

      for (const [docUri, docCached] of openDocuments.entries()) {
        for (const macroCall of docCached.parsed.macroCalls) {
          if (macroCall.macro.lexeme === enclosingMacro.name) {
            const substitution = buildMacroSubstitution(docCached.parsed, macroCall);
            const paramSub = substitution.parameterSubstitutions.find((s) => s.parameterIndex === parameterIndex);

            if (paramSub !== undefined) {
              const argumentTokens = paramSub.argumentTokens.filter(
                (t) => t.kind === "identifier" || t.kind === "label" || t.kind === "localLabel"
              );
              for (const token of argumentTokens) {
                const defs = findDefinition(openDocuments, docUri, macroCall.line, token.start);
                if (defs !== null) {
                  if (Array.isArray(defs)) {
                    locations.push(...defs);
                  } else {
                    locations.push(defs);
                  }
                }
              }
            }
          }
        }
      }

      if (locations.length > 0) {
        const uniqueLocations = Array.from(
          new Map(locations.map((l) => [JSON.stringify(l), l])).values()
        );
        return uniqueLocations.length === 1 ? uniqueLocations[0] : uniqueLocations;
      }
    }
  }

  const locations: Location[] = [];
  for (const [documentUri, docCached] of openDocuments.entries()) {
    for (const definition of collectDefinitions(documentUri, docCached)) {
      if (definition.name === targetName) {
        locations.push(definition.location);
      }
    }
  }

  if (locations.length === 0) {
    return null;
  }

  const uniqueLocations = Array.from(
    new Map(locations.map((l) => [JSON.stringify(l), l])).values()
  );
  return uniqueLocations.length === 1 ? uniqueLocations[0] : uniqueLocations;
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
  return [...collectSymbols(cached.parsed).values()].map((symbol) => ({
    name: symbol.name,
    location: {
      uri,
      range: {
        start: { line: symbol.line, character: symbol.token.start },
        end: { line: symbol.line, character: symbol.token.end }
      }
    }
  }));
}

export function collectReferences(uri: string, cached: CachedDocument): readonly SymbolReference[] {
  const references: SymbolReference[] = [];

  for (const line of cached.parsed.lines) {
    const tokens = getReferencedTokens(cached, line.line, line.node);

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

function getReferencedTokens(cached: CachedDocument, lineNumber: number, node: ParsedLine): readonly Token[] {
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
    const macroCall = cached.parsed.macroCalls.find((call) => call.line === lineNumber);
    if (macroCall === undefined) {
      return [node.macro];
    }

    const substitution = buildMacroSubstitution(cached.parsed, macroCall);
    const expandedReferences = substitution.parameterSubstitutions.flatMap((parameterSubstitution) =>
      parameterSubstitution.argumentTokens.filter(
        (token) => token.kind === "identifier" || token.kind === "label"
      )
    );

    return expandedReferences.length > 0 ? expandedReferences : [node.macro];
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
