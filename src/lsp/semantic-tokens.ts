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
  SemanticTokenTypes.variable
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

export function buildSemanticTokens(cached: CachedDocument): SemanticTokens {
  const builder = new SemanticTokensBuilder();

  for (const line of cached.lexed.lines) {
    for (const token of line.tokens) {
      const typeIndex = tokenTypeMap[token.kind];
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
