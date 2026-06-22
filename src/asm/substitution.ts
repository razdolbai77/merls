import { type ParsedDocument, type MacroCallSite } from "./document";
import { type Token } from "./lexer";

export type MacroBodyParameterReference = {
  line: number;
  token: Token;
};

export type MacroParameterSubstitution = {
  parameterIndex: number;
  argumentTokens: readonly Token[];
  referencedSymbols: readonly string[];
  bodyReferences: readonly MacroBodyParameterReference[];
};

export type MacroSubstitution = {
  macroName: string;
  callLine: number;
  parameterSubstitutions: readonly MacroParameterSubstitution[];
  unusedArguments: readonly number[];
};

export function buildMacroSubstitution(
  document: ParsedDocument,
  macroCall: MacroCallSite
): MacroSubstitution {
  const macroDefinition = document.macroDefinitions.find((definition) => definition.name === macroCall.macro.lexeme);
  if (macroDefinition === undefined) {
    throw new Error(`Unknown macro definition: ${macroCall.macro.lexeme}`);
  }

  const argumentTokens = splitMacroCallArguments(macroCall.args);
  const parameterSubstitutions: MacroParameterSubstitution[] = [];
  const unusedArguments: number[] = [];

  for (let index = 1; index <= Math.max(argumentTokens.length, macroDefinition.maxParameterIndex); index += 1) {
    const bodyReferences = macroDefinition.body.flatMap((bodyLine) =>
      bodyLine.parameterReferences
        .filter((reference) => reference.index === index)
        .map((reference) => ({
          line: bodyLine.line,
          token: reference.token
        }))
    );
    const tokens = argumentTokens[index - 1] ?? [];
    if (bodyReferences.length === 0 && tokens.length > 0) {
      unusedArguments.push(index);
    }

    if (bodyReferences.length === 0 && tokens.length === 0) {
      continue;
    }

    parameterSubstitutions.push({
      parameterIndex: index,
      argumentTokens: tokens,
      referencedSymbols: collectReferencedSymbols(tokens),
      bodyReferences
    });
  }

  return {
    macroName: macroCall.macro.lexeme,
    callLine: macroCall.line,
    parameterSubstitutions,
    unusedArguments
  };
}

function splitMacroCallArguments(tokens: readonly Token[]): readonly (readonly Token[])[] {
  if (tokens.length === 0) {
    return [];
  }

  const argumentsByIndex: Token[][] = [[]];
  let depth = 0;

  for (const token of tokens) {
    if (token.kind === "expressionOperator" && token.lexeme === "(") {
      depth += 1;
      argumentsByIndex.at(-1)?.push(token);
      continue;
    }

    if (token.kind === "expressionOperator" && token.lexeme === ")") {
      depth = Math.max(0, depth - 1);
      argumentsByIndex.at(-1)?.push(token);
      continue;
    }

    if (token.kind === "expressionOperator" && token.lexeme === "," && depth === 0) {
      argumentsByIndex.push([]);
      continue;
    }

    argumentsByIndex.at(-1)?.push(token);
  }

  return argumentsByIndex;
}

function collectReferencedSymbols(tokens: readonly Token[]): readonly string[] {
  return [...new Set(
    tokens
      .filter((token) => token.kind === "identifier" || token.kind === "label")
      .map((token) => token.lexeme)
  )];
}
