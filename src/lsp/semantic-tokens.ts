import { SemanticTokens, SemanticTokensBuilder, SemanticTokensLegend, SemanticTokenTypes } from "vscode-languageserver";
import { type TokenKind } from "../asm/lexer";
import { type CachedDocument } from "../asm/document";

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

const tokenTypeMap: Record<TokenKind, number> = {
  comment: tokenTypesList.indexOf(SemanticTokenTypes.comment),
  label: tokenTypesList.indexOf(SemanticTokenTypes.function),
  localLabel: tokenTypesList.indexOf(SemanticTokenTypes.function),
  directive: tokenTypesList.indexOf(SemanticTokenTypes.macro),
  mnemonic: tokenTypesList.indexOf(SemanticTokenTypes.keyword),
  string: tokenTypesList.indexOf(SemanticTokenTypes.string),
  numericLiteral: tokenTypesList.indexOf(SemanticTokenTypes.number),
  modifier: tokenTypesList.indexOf(SemanticTokenTypes.operator),
  expressionOperator: tokenTypesList.indexOf(SemanticTokenTypes.operator),
  identifier: tokenTypesList.indexOf(SemanticTokenTypes.variable)
};
import { directiveTable } from "../asm/metadata";

type SemanticSymbolsCache = {
  allSymbols: Set<string>;
  allMacros: Set<string>;
};

const semanticSymbolsCache = new WeakMap<Map<string, CachedDocument>, SemanticSymbolsCache>();

export function buildSemanticTokens(cached: CachedDocument, indexedDocuments: Map<string, CachedDocument>): SemanticTokens {
  const builder = new SemanticTokensBuilder();

  let cache = semanticSymbolsCache.get(indexedDocuments);
  if (cache === undefined) {
    const allSymbols = new Set<string>();
    const allMacros = new Set<string>();
    
    for (const doc of indexedDocuments.values()) {
      const docSymbols = doc.symbols;
      for (const [name, definition] of docSymbols.entries()) {
        allSymbols.add(name);
        if (definition.kind === "macro") {
          allMacros.add(name);
        }
      }
    }
    cache = { allSymbols, allMacros };
    semanticSymbolsCache.set(indexedDocuments, cache);
  }

  const { allSymbols, allMacros } = cache;

  // Also collect local labels from the current document
  // (In a real scenario, you'd use resolveLocalLabels, but for simple highlighting, matching the text is often enough)
  const isResolved = (name: string) => allSymbols.has(name) || name.startsWith("]") || name.startsWith(":");



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
          if (dirDef?.completions && dirDef.completions.includes(token.lexeme.toUpperCase())) {
            isKnownCompletion = true;
          }
        }

        if (isKnownCompletion) {
          // Color known directive arguments (like BIN for TYP) as numbers/constants
          typeIndex = tokenTypeMap["numericLiteral"];
        } else if (parsedLine?.shape === "directive" && parsedLine.directive.lexeme.toLowerCase() === "mac" && token.start === parsedLine.label?.start) {
          typeIndex = tokenTypesList.indexOf(SemanticTokenTypes.macro);
        } else if (parsedLine?.shape === "macroCall" && token.start === parsedLine.macro.start) {
          typeIndex = tokenTypesList.indexOf(SemanticTokenTypes.macro);
        } else if (/^\]\d+$/.test(token.lexeme)) {
          // Macro parameter placeholder
          typeIndex = tokenTypesList.indexOf(SemanticTokenTypes.parameter);
        } else if (isResolved(token.lexeme)) {
          if (allMacros.has(token.lexeme)) {
            typeIndex = tokenTypesList.indexOf(SemanticTokenTypes.macro);
          } else {
            typeIndex = tokenTypesList.indexOf(SemanticTokenTypes.function); // label
          }
        } else {
          // Unresolved! Let's color it as variable
          typeIndex = tokenTypesList.indexOf(SemanticTokenTypes.variable);
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
