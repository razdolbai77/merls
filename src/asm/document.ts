import { type LexedSource, type Token, lexSource } from "./lexer";
import { parseSourceLines, type ParsedLine } from "./parser";

export type DocumentLine = {
  line: number;
  node: ParsedLine;
  tokens: readonly Token[];
};

export type DocumentError = {
  line: number;
  text: string;
  message: string;
};

export type MacroParameterReference = {
  token: Token;
  index: number;
};

export type MacroBodyLine = {
  line: number;
  node: ParsedLine;
  tokens: readonly Token[];
  parameterReferences: readonly MacroParameterReference[];
};

export type MacroDefinition = {
  name: string;
  nameToken: Token;
  startLine: number;
  endLine: number | null;
  startDirective: Token;
  endDirective: Token | null;
  body: readonly MacroBodyLine[];
  parameterReferences: readonly MacroParameterReference[];
  maxParameterIndex: number;
};

export type MacroCallSite = {
  line: number;
  label: Token | null;
  macro: Token;
  args: readonly Token[];
};

export type ParsedDocument = {
  lines: readonly DocumentLine[];
  errors: readonly DocumentError[];
  macroDefinitions: readonly MacroDefinition[];
  macroCalls: readonly MacroCallSite[];
};

export type CachedDocument = {
  source: string;
  lexed: LexedSource;
  parsed: ParsedDocument;
};

export function buildCachedDocument(source: string): CachedDocument {
  const lexed = lexSource(source);
  const parsed = parseDocument(lexed);
  return { source, lexed, parsed };
}

export function parseDocument(source: string | LexedSource): ParsedDocument {
  const lexed = typeof source === "string" ? lexSource(source) : source;
  const parsedLines = parseSourceLines(lexed);
  const lines: DocumentLine[] = [];
  const errors: DocumentError[] = [];
  const macroCalls: MacroCallSite[] = [];

  parsedLines.forEach((node, line) => {
    const tokens = lexed.lines[line]?.tokens ?? [];
    lines.push({
      line,
      node,
      tokens
    });

    if (node.shape === "malformed") {
      errors.push({
        line,
        text: node.text,
        message: node.message
      });
    }

    if (node.shape === "macroCall") {
      macroCalls.push({
        line,
        label: node.label,
        macro: node.macro,
        args: node.args
      });
    }
  });

  const macroDefinitions = collectMacroDefinitions(lines);

  return {
    lines,
    errors,
    macroDefinitions,
    macroCalls
  };
}

function collectMacroDefinitions(lines: readonly DocumentLine[]): readonly MacroDefinition[] {
  const macroDefinitions: MacroDefinition[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const startLine = lines[index];
    const startNode = startLine?.node;

    if (
      startNode?.shape !== "directive" ||
      startNode.label === null ||
      startNode.directive.lexeme.toLowerCase() !== "mac"
    ) {
      continue;
    }

    const body: MacroBodyLine[] = [];
    const parameterReferences: MacroParameterReference[] = [];
    let endLine: number | null = null;
    let endDirective: Token | null = null;

    for (let bodyIndex = index + 1; bodyIndex < lines.length; bodyIndex += 1) {
      const currentLine = lines[bodyIndex];
      const currentNode = currentLine?.node;

      if (
        currentNode?.shape === "directive" &&
        (currentNode.directive.lexeme.toLowerCase() === "eom" ||
          currentNode.directive.lexeme === "<<<")
      ) {
        endLine = currentLine.line;
        endDirective = currentNode.directive;
        break;
      }

      const bodyParameterReferences = collectMacroParameterReferences(currentLine.tokens);
      parameterReferences.push(...bodyParameterReferences);
      body.push({
        line: currentLine.line,
        node: currentNode,
        tokens: currentLine.tokens,
        parameterReferences: bodyParameterReferences
      });
    }

    macroDefinitions.push({
      name: startNode.label.lexeme,
      nameToken: startNode.label,
      startLine: startLine.line,
      endLine,
      startDirective: startNode.directive,
      endDirective,
      body,
      parameterReferences,
      maxParameterIndex: parameterReferences.reduce(
        (max, parameterReference) => Math.max(max, parameterReference.index),
        0
      )
    });
  }

  return macroDefinitions;
}

function collectMacroParameterReferences(tokens: readonly Token[]): readonly MacroParameterReference[] {
  const parameterReferences: MacroParameterReference[] = [];

  for (const token of tokens) {
    const match = /^\](\d+)$/u.exec(token.lexeme);
    if (match === null) {
      continue;
    }

    parameterReferences.push({
      token,
      index: Number.parseInt(match[1] ?? "0", 10)
    });
  }

  return parameterReferences;
}
