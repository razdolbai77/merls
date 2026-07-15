import { type LexedSource, type Token, lexSource } from "./lexer";
import { collectSymbols, type SymbolDefinition } from "./symbols";
import {
  parseSourceStructure,
  type MacroBodyLine,
  type MacroDefinitionRegion,
  type ParsedLine
} from "./parser";

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

export type MacroDefinition = MacroDefinitionRegion & {
  body: readonly DocumentMacroBodyLine[];
};

export type DocumentMacroBodyLine = Omit<MacroBodyLine, "node"> & {
  node: ParsedLine;
  tokens: readonly Token[];
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
  symbols: Map<string, SymbolDefinition>;
};

export function buildCachedDocument(source: string): CachedDocument {
  const lexed = lexSource(source);
  const parsed = parseDocument(lexed);
  const symbols = collectSymbols(parsed);
  return { source, lexed, parsed, symbols };
}

export function parseDocument(source: string | LexedSource): ParsedDocument {
  const lexed = typeof source === "string" ? lexSource(source) : source;
  const parsed = parseSourceStructure(lexed);
  const parsedLines = parsed.lines;
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

  const macroDefinitions = parsed.macroDefinitions.map((macroDefinition) => ({
    ...macroDefinition,
    body: macroDefinition.body.map((bodyLine) => ({
      ...bodyLine,
      tokens: lexed.lines[bodyLine.line]?.tokens ?? []
    }))
  }));

  return {
    lines,
    errors,
    macroDefinitions,
    macroCalls
  };
}
