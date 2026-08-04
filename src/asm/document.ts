import { type LexedSource, type Token, lexSource } from "./lexer";
import { collectSymbols, type SymbolDefinition } from "./symbols";
import {
  getAssemblyEndLine,
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
  body: readonly MacroBodyLine[];
};


export type MacroCallSite = {
  line: number;
  label: Token | null;
  macro: Token;
  args: readonly Token[];
};

export type LoopRegion = {
  startLine: number;
  endLine: number | null;
  startDirective: Token;
  endDirective: Token | null;
};

export type UnmatchedLoopTerminator = {
  line: number;
  token: Token;
};

export type ParsedDocument = {
  lines: readonly DocumentLine[];
  errors: readonly DocumentError[];
  macroDefinitions: readonly MacroDefinition[];
  macroCalls: readonly MacroCallSite[];
  loopRegions: readonly LoopRegion[];
  unmatchedLoopTerminators: readonly UnmatchedLoopTerminator[];
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
  const assemblyEndLine = getAssemblyEndLine(parsedLines);
  const lines: DocumentLine[] = [];
  const errors: DocumentError[] = [];
  const macroCalls: MacroCallSite[] = [];
  const loopRegions: LoopRegion[] = [];
  const unmatchedLoopTerminators: UnmatchedLoopTerminator[] = [];
  const openLoopStarts: { line: number; token: Token }[] = [];

  for (const [line, node] of parsedLines.entries()) {
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

    if (node.shape === "directive") {
      const directiveName = node.directive.lexeme.toLowerCase();
      if (directiveName === "lup") {
        openLoopStarts.push({ line, token: node.directive });
      } else if (directiveName === "--^") {
        const loopStart = openLoopStarts.pop();
        if (loopStart === undefined) {
          unmatchedLoopTerminators.push({ line, token: node.directive });
        } else {
          loopRegions.push({
            startLine: loopStart.line,
            endLine: line,
            startDirective: loopStart.token,
            endDirective: node.directive
          });
        }
      }
    }



    if (
      (assemblyEndLine === null || line <= assemblyEndLine) &&
      node.shape === "macroCall"
    ) {
      macroCalls.push({
        line,
        label: node.label,
        macro: node.macro,
        args: node.args
      });
    }
  }

  for (const loopStart of openLoopStarts) {
    loopRegions.push({
      startLine: loopStart.line,
      endLine: null,
      startDirective: loopStart.token,
      endDirective: null
    });
  }
  loopRegions.sort((left, right) => left.startLine - right.startLine);

  const macroDefinitions = parsed.macroDefinitions.map((macroDefinition) => ({
    ...macroDefinition,
    body: macroDefinition.body
  }));

  return {
    lines,
    errors,
    macroDefinitions,
    macroCalls,
    loopRegions,
    unmatchedLoopTerminators
  };
}
