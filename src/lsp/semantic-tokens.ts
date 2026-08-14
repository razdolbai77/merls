import { SemanticTokens, SemanticTokensBuilder, SemanticTokensLegend, SemanticTokenTypes } from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { type TokenKind } from "../asm/lexer";
import { resolveLocalLabels, isLocalLabel, isLocalLabelResolved, type LocalLabelScope } from "../asm/local-labels";
import { macroParameterPattern } from "../asm/macros";
import { directiveTable } from "../asm/metadata";

const tokenTypesList = [
  SemanticTokenTypes.comment,
  SemanticTokenTypes.function,
  SemanticTokenTypes.macro,
  SemanticTokenTypes.keyword,
  SemanticTokenTypes.string,
  SemanticTokenTypes.number,
  SemanticTokenTypes.operator,
  SemanticTokenTypes.variable,
  SemanticTokenTypes.parameter
];

export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes: tokenTypesList,
  tokenModifiers: []
};

const COMMENT_TYPE_INDEX = tokenTypesList.indexOf(SemanticTokenTypes.comment);
const FUNCTION_TYPE_INDEX = tokenTypesList.indexOf(SemanticTokenTypes.function);
const MACRO_TYPE_INDEX = tokenTypesList.indexOf(SemanticTokenTypes.macro);
const KEYWORD_TYPE_INDEX = tokenTypesList.indexOf(SemanticTokenTypes.keyword);
const STRING_TYPE_INDEX = tokenTypesList.indexOf(SemanticTokenTypes.string);
const NUMBER_TYPE_INDEX = tokenTypesList.indexOf(SemanticTokenTypes.number);
const OPERATOR_TYPE_INDEX = tokenTypesList.indexOf(SemanticTokenTypes.operator);
const VARIABLE_TYPE_INDEX = tokenTypesList.indexOf(SemanticTokenTypes.variable);
const PARAMETER_TYPE_INDEX = tokenTypesList.indexOf(SemanticTokenTypes.parameter);

const tokenTypeMap: Record<TokenKind, number> = {
  comment: COMMENT_TYPE_INDEX,
  label: FUNCTION_TYPE_INDEX,
  localLabel: FUNCTION_TYPE_INDEX,
  directive: MACRO_TYPE_INDEX,
  mnemonic: KEYWORD_TYPE_INDEX,
  string: STRING_TYPE_INDEX,
  numericLiteral: NUMBER_TYPE_INDEX,
  modifier: OPERATOR_TYPE_INDEX,
  expressionOperator: OPERATOR_TYPE_INDEX,
  identifier: VARIABLE_TYPE_INDEX
};

const directiveCompletionSetCache = new WeakMap<readonly string[], Set<string>>();

function getDirectiveCompletionSet(completions: readonly string[]): Set<string> {
  let set = directiveCompletionSetCache.get(completions);
  if (set === undefined) {
    set = new Set(completions);
    directiveCompletionSetCache.set(completions, set);
  }
  return set;
}

type SemanticSymbolsCache = {
  allSymbols: Set<string>;
  allVariables: Set<string>;
  allMacros: Set<string>;
};

const semanticSymbolsCache = new WeakMap<Map<string, CachedDocument>, SemanticSymbolsCache>();

const localScopeCache = new WeakMap<CachedDocument, LocalLabelScope>();

export function buildSemanticTokens(cached: CachedDocument, indexedDocuments: Map<string, CachedDocument>): SemanticTokens {
  const builder = new SemanticTokensBuilder();

  let cache = semanticSymbolsCache.get(indexedDocuments);
  if (cache === undefined) {
    const allSymbols = new Set<string>();
    const allMacros = new Set<string>();
    const allVariables = new Set<string>();
    
    for (const doc of indexedDocuments.values()) {
      const docSymbols = doc.symbols;
      for (const [name, definition] of docSymbols.entries()) {
        allSymbols.add(name);
        if (definition.kind === "macro") {
          allMacros.add(name);
        }
        if (definition.kind === "variable") {
          allVariables.add(name);
        }
      }
    }
    cache = { allSymbols, allMacros, allVariables };
    semanticSymbolsCache.set(indexedDocuments, cache);
  }

  const { allSymbols, allMacros, allVariables } = cache;

  // Cache local-label resolution for current document.
  let localScope = localScopeCache.get(cached);
  if (localScope === undefined) {
    localScope = resolveLocalLabels(cached.parsed);
    localScopeCache.set(cached, localScope);
  }

  const isResolved = (name: string, line: number) => {
    if (allSymbols.has(name)) return true;
    if (isLocalLabel(name)) {
      return isLocalLabelResolved(localScope, name, line);
    }
    return false;
  };


  for (const line of cached.lexed.lines) {
    const parsedLine = cached.parsed.lines[line.line]?.node;

    for (const token of line.tokens) {
      let typeIndex = tokenTypeMap[token.kind];

      if (
        parsedLine?.shape === "data" &&
        parsedLine.directive.lexeme.toLowerCase() === "hex" &&
        token.start > parsedLine.directive.end &&
        token.kind !== "comment"
      ) {
        typeIndex = tokenTypeMap["numericLiteral"];
      } else if (token.kind === "identifier" || token.kind === "localLabel") {
        let isKnownCompletion = false;
        
        // Check if it's a known completion argument for the current directive
        if (parsedLine?.shape === "directive") {
          const dirDef = directiveTable.get(parsedLine.directive.lexeme.toLowerCase());
          if (dirDef?.completions && getDirectiveCompletionSet(dirDef.completions).has(token.lexeme.toUpperCase())) {
            isKnownCompletion = true;
          }
        }

        if (isKnownCompletion) {
          // Color known directive arguments (like BIN for TYP) as numbers/constants
          typeIndex = NUMBER_TYPE_INDEX;
        } else if (parsedLine?.shape === "directive" && parsedLine.directive.lexeme.toLowerCase() === "mac" && token.start === parsedLine.label?.start) {
          typeIndex = MACRO_TYPE_INDEX;
        } else if (parsedLine?.shape === "macroCall" && token.start === parsedLine.macro.start) {
          typeIndex = MACRO_TYPE_INDEX;
        } else if (macroParameterPattern.test(token.lexeme)) {
          // Macro parameter placeholder
          typeIndex = PARAMETER_TYPE_INDEX;
        } else if (allVariables.has(token.lexeme)) {
          typeIndex = VARIABLE_TYPE_INDEX;
        } else if (isResolved(token.lexeme, line.line)) {
          if (allMacros.has(token.lexeme)) {
            typeIndex = MACRO_TYPE_INDEX;
          } else {
            typeIndex = FUNCTION_TYPE_INDEX; // label
          }
        } else {
          // Unresolved names use variable tokens.
          typeIndex = VARIABLE_TYPE_INDEX;
        }
      }

      const length = token.end - token.start;
      builder.push(
        line.line,
        token.start,
        length,
        typeIndex,
        0
      );
    }
  }

  return builder.build();
}
