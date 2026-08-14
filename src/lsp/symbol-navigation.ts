import { type Location } from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { type Expression, walkExpression } from "../asm/expression";
import { getCallSiteToken, getEffectiveLines, splitMacroCallArguments } from "../asm/expansion";
import { type Token, tokenAtCharacter } from "../asm/lexer";
import { isLocalLabel, resolveLocalLabels, getLocalLabelTargetLine } from "../asm/local-labels";
import { macroParameterPattern } from "../asm/macros";
import { type ParsedLine } from "../asm/parser";
import { collectSymbols } from "../asm/symbols";

export type SymbolDefinition = {
  name: string;
  location: Location;
};

type SymbolReference = {
  name: string;
  location: Location;
};

export function uniqueLocations<T>(items: readonly T[]): T[] {
  return Array.from(
    new Map(items.map((item) => [JSON.stringify(item), item])).values()
  );
}

export function findDefinition(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number
): Location | Location[] | null {
  const cached = openDocuments.get(uri);
  const targetName = getSymbolAtPosition(cached, line, character);
  if (targetName === null) return null;

  const parameterDefinition = findMacroParameterDefinition(openDocuments, cached, targetName, line);
  if (parameterDefinition !== null) return parameterDefinition;

  const variableDefinition = findVariableDefinition(cached, uri, targetName);
  if (variableDefinition !== null) return variableDefinition;

  if (isLocalLabel(targetName)) {
    return findLocalLabelDefinition(cached, uri, targetName, line);
  }
  return findWorkspaceDefinitions(openDocuments, targetName);
}

function findMacroParameterDefinition(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  cached: CachedDocument | undefined,
  targetName: string,
  line: number
): Location | Location[] | null {
  const parameterMatch = macroParameterPattern.exec(targetName);
  if (parameterMatch === null || cached === undefined) return null;

  const parameterIndex = Number.parseInt(parameterMatch[1] ?? "0", 10);
  const enclosingMacro = cached.parsed.macroDefinitions.find(
    (definition) => line > definition.startLine && (definition.endLine === null || line < definition.endLine)
  );
  if (enclosingMacro === undefined) return null;

  const locations: Location[] = [];
  for (const [documentUri, document] of openDocuments.entries()) {
    for (const macroCall of document.parsed.macroCalls) {
      if (macroCall.macro.lexeme !== enclosingMacro.name) continue;

      const argumentsAtCallSite = splitMacroCallArguments(macroCall.args);
      const parameterTokens = argumentsAtCallSite[parameterIndex - 1] ?? [];
      for (const token of parameterTokens) {
        if (token.kind === "identifier" || token.kind === "label" || token.kind === "localLabel") {
          addDefinitionLocations(locations, findDefinition(openDocuments, documentUri, macroCall.line, token.start));
        }
      }
    }
  }
  return locations.length > 0 ? toDefinitionResult(locations) : null;
}

function addDefinitionLocations(locations: Location[], definitions: Location | Location[] | null): void {
  if (definitions === null) return;
  if (Array.isArray(definitions)) {
    locations.push(...definitions);
  } else {
    locations.push(definitions);
  }
}

function findVariableDefinition(
  cached: CachedDocument | undefined,
  uri: string,
  targetName: string
): Location | null {
  const symbol = cached === undefined ? undefined : collectSymbols(cached.parsed).get(targetName);
  if (symbol?.kind !== "variable") return null;

  return {
    uri,
    range: {
      start: { line: symbol.line, character: symbol.token.start },
      end: { line: symbol.line, character: symbol.token.end }
    }
  };
}

function findLocalLabelDefinition(
  cached: CachedDocument | undefined,
  uri: string,
  targetName: string,
  line: number
): Location | null {
  if (cached === undefined) return null;

  const localScope = resolveLocalLabels(cached.parsed);
  const targetLine = getLocalLabelTargetLine(localScope, targetName, line);
  if (targetLine === undefined) return null;

  const targetLexedLine = cached.lexed.lines[targetLine];
  const definitionToken = targetLexedLine?.tokens.find(
    (token) => token.lexeme === targetName && (token.kind === "localLabel" || token.kind === "label")
  );
  if (definitionToken === undefined) return null;

  return {
    uri,
    range: {
      start: { line: targetLine, character: definitionToken.start },
      end: { line: targetLine, character: definitionToken.end }
    }
  };
}

function findWorkspaceDefinitions(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  targetName: string
): Location | Location[] | null {
  const locations: Location[] = [];
  for (const [uri, cached] of openDocuments.entries()) {
    for (const definition of collectDefinitions(uri, cached)) {
      if (definition.name === targetName) locations.push(definition.location);
    }
  }
  return locations.length > 0 ? toDefinitionResult(locations) : null;
}

function toDefinitionResult(locations: readonly Location[]): Location | Location[] {
  const deduped = uniqueLocations(locations);
  return deduped.length === 1 ? deduped[0]! : deduped;
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
  const allMacros = Array.from(openDocuments.values()).flatMap((document) => document.parsed.macroDefinitions);


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

    const effectiveLines = getEffectiveLines(cached.parsed, allMacros);

    for (const line of effectiveLines) {
      const tokens = getReferencedTokens(cached, line.line, line.node);

      for (const token of tokens) {
        const callSiteToken = getCallSiteToken(token, line.isExpanded);
        if (line.isExpanded && !callSiteToken) {
          continue;
        }
        if (token.lexeme === targetName) {
          const rangeToken = callSiteToken ?? token;

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

  return uniqueLocations(locations);
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
        const callSiteToken = getCallSiteToken(token, line.isExpanded);
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

  return uniqueLocations(references);
}

export function getReferencedTokens(cached: CachedDocument, lineNumber: number, node: ParsedLine): readonly Token[] {
  if (node.shape === "instruction" && node.operand !== null) {
    return collectExpressionIdentifiers(node.operand.expression);
  }

  if (node.shape === "directive" && node.operand !== null) {
    const tokens: Token[] = [...collectExpressionIdentifiers(node.operand)];
    for (const additionalOperand of node.additionalOperands ?? []) {
      tokens.push(...collectExpressionIdentifiers(additionalOperand));
    }
    return tokens.filter((token) => token.lexeme !== "\\");
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
