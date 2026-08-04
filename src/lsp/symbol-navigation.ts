import { type Location } from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { type Expression, isAccumulatorOperand, walkExpression } from "../asm/expression";
import { type ParsedLine } from "../asm/parser";
import { type Token, tokenAtCharacter } from "../asm/lexer";
import { collectSymbols } from "../asm/symbols";
import { splitMacroCallArguments, getEffectiveLines, type ExpandedToken } from "../asm/expansion";
import { resolveLocalLabels, isLocalLabel } from "../asm/local-labels";

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
            const argumentTokens = splitMacroCallArguments(macroCall.args);
            const paramTokens = argumentTokens[parameterIndex - 1] ?? [];
            const validTokens = paramTokens.filter(
              (t) => t.kind === "identifier" || t.kind === "label" || t.kind === "localLabel"
            );

            for (const token of validTokens) {
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

      if (locations.length > 0) {
        const uniqueLocations = Array.from(
          new Map(locations.map((l) => [JSON.stringify(l), l])).values()
        );
        return uniqueLocations.length === 1 ? uniqueLocations[0] : uniqueLocations;
      }
    }
  }

  const variableSymbol = cached === undefined
    ? undefined
    : collectSymbols(cached.parsed).get(targetName);
  if (variableSymbol?.kind === "variable") {
    return {
      uri,
      range: {
        start: { line: variableSymbol.line, character: variableSymbol.token.start },
        end: { line: variableSymbol.line, character: variableSymbol.token.end }
      }
    };
  }

  const isLocal = isLocalLabel(targetName);

  if (isLocal && cached !== undefined) {
    const localScope = resolveLocalLabels(cached.parsed);
    const localKey = `${targetName}@${line}`;
    
    const reference = localScope.references.get(localKey);
    const targetLine = reference?.targetLine ?? (localScope.definitions.get(localKey)?.line);

    if (targetLine === undefined) {
      return null; // Unresolved or out-of-scope local label
    }

    const targetLexedLine = cached.lexed.lines[targetLine];
    if (targetLexedLine !== undefined) {
      const defToken = targetLexedLine.tokens.find(t => t.lexeme === targetName && (t.kind === "localLabel" || t.kind === "label"));
      if (defToken !== undefined) {
        return {
          uri,
          range: {
            start: { line: targetLine, character: defToken.start },
            end: { line: targetLine, character: defToken.end }
          }
        };
      }
    }
    return null;
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
  const targetCached = openDocuments.get(uri);
  const isVariable = targetCached !== undefined &&
    collectSymbols(targetCached.parsed).get(targetName)?.kind === "variable";


  const locations: Location[] = [];

  for (const [documentUri, cached] of openDocuments.entries()) {
    if (isVariable && documentUri !== uri) {
      continue;
    }
    if (includeDeclaration) {
      for (const definition of collectDefinitions(documentUri, cached)) {
        if (definition.name === targetName) {
          locations.push(definition.location);
        }
      }
    }

    const allMacros = Array.from(openDocuments.values()).flatMap((doc) => doc.parsed.macroDefinitions);
    const effectiveLines = getEffectiveLines(cached.parsed, allMacros);

    for (const line of effectiveLines) {
      const tokens = getReferencedTokens(cached, line.line, line.node);

      for (const token of tokens) {
        if (line.isExpanded) {
          const expandedToken = token as ExpandedToken;
          if (!expandedToken.callSiteToken) {
            continue;
          }
        }
        if (token.lexeme === targetName) {
          const rangeToken = "callSiteToken" in token
            ? ((token as ExpandedToken).callSiteToken ?? token)
            : token;

          locations.push({
            uri: documentUri,
            range: {
              start: { line: line.line, character: rangeToken.start },
              end: { line: line.line, character: rangeToken.end }
            }
          });
        }
      }
    }
  }

  const uniqueLocations = Array.from(
    new Map(locations.map((l) => [JSON.stringify(l), l])).values()
  );

  return uniqueLocations;
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
  const effectiveLines = getEffectiveLines(cached.parsed, cached.parsed.macroDefinitions);

  for (const line of effectiveLines) {
    const tokens = getReferencedTokens(cached, line.line, line.node);

    for (const token of tokens) {
      let rangeToken: Token = token;
      if (line.isExpanded) {
        const callSiteToken = (token as ExpandedToken).callSiteToken;
        if (!callSiteToken) {
          continue;
        }
        if (callSiteToken.kind !== "identifier" && callSiteToken.kind !== "label" && callSiteToken.kind !== "localLabel") {
          continue;
        }
        rangeToken = callSiteToken;
      }

      references.push({
        name: token.lexeme,
        location: {
          uri,
          range: {
            start: { line: line.line, character: rangeToken.start },
            end: { line: line.line, character: rangeToken.end }
          }
        }
      });
    }
  }

  const uniqueReferences = Array.from(
    new Map(references.map((r) => [JSON.stringify(r), r])).values()
  );

  return uniqueReferences;
}

export function getReferencedTokens(cached: CachedDocument, lineNumber: number, node: ParsedLine): readonly Token[] {
  if (node.shape === "instruction" && node.operand !== null) {
    const refs = collectExpressionIdentifiers(node.operand.expression);
    if (refs.length === 1 && isAccumulatorOperand(node.mnemonic.lexeme, node.operand, refs[0])) {
      return [];
    }
    return refs;
  }

  if (node.shape === "directive" && node.operand !== null) {
    return collectExpressionIdentifiers(node.operand);
  }

  if (node.shape === "equate") {
    return collectExpressionIdentifiers(node.expression);
  }

  if (node.shape === "macroCall") {
    const tokens: Token[] = [node.macro];
    for (const arg of node.args) {
      if (arg.kind === "identifier" || arg.kind === "label" || arg.kind === "localLabel") {
        tokens.push(arg);
      }
    }
    return tokens;
  }

  return [];
}

function collectExpressionIdentifiers(expression: Expression): readonly Token[] {
  const tokens: Token[] = [];
  walkExpression(expression, (identifier) => tokens.push(identifier.token));
  return tokens;
}
