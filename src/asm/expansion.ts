import { stripTrailingComment } from "./parser";
import { type MacroCallLine, type MacroDefinitionRegion, type ParsedLine, parseLexedLine } from "./parser";
import { type Token } from "./lexer";
import { type ParsedDocument } from "./document";
import { MAX_MACRO_EXPANSION_DEPTH, MAX_MACRO_EXPANSION_LINES } from "./limits";

export type ExpandedToken = Token & {
  callSiteToken: Token | null;
};

export type ExpandedLine = {
  text: string;
  tokens: readonly ExpandedToken[];
};

export type ExpandedMacro = {
  lines: readonly ExpandedLine[];
  parsedLines: readonly ParsedLine[];
};

const macroExpansionCache = new WeakMap<MacroCallLine, {
  definition: MacroDefinitionRegion | undefined;
  expansion: ExpandedMacro;
}>();

export function expandMacroCall(
  callLine: MacroCallLine,
  macroDefinitions: readonly MacroDefinitionRegion[]
): ExpandedMacro {
  const definition = macroDefinitions.find((def) => def.name === callLine.macro.lexeme);

  const cached = macroExpansionCache.get(callLine);
  if (cached && cached.definition === definition) {
    return cached.expansion;
  }

  if (!definition) {
    const result = { lines: [], parsedLines: [] };
    macroExpansionCache.set(callLine, { definition, expansion: result });
    return result;
  }

  const args = splitMacroCallArguments(callLine.args);

  const lines: ExpandedLine[] = [];

  for (const bodyLine of definition.body) {
    // Collect all tokens from the original line, and substitute parameters
    const expandedTokens: ExpandedToken[] = [];
    const nodeTokens = stripTrailingComment(bodyLine.tokens);
    let lastTokenEnd = nodeTokens[0]?.start ?? 0;
    
    let expandedText = "";

    for (const token of nodeTokens) {
      const match = /^\](\d+)$/u.exec(token.lexeme);
      if (token.kind === "localLabel" && match !== null) {
        const paramIndex = Number.parseInt(match[1]!, 10);
        if (paramIndex === 0) {
          const countLexeme = String(args.length);
          const spaceBefore = " ".repeat(token.start - lastTokenEnd);
          const start = expandedText.length + spaceBefore.length;
          expandedText += spaceBefore + countLexeme;
          expandedTokens.push({
            ...token,
            kind: "numericLiteral",
            lexeme: countLexeme,
            start,
            end: start + countLexeme.length,
            callSiteToken: null
          });
          lastTokenEnd = token.end;
          continue;
        }

        const argTokens = args[paramIndex - 1] ?? [];
        if (argTokens.length > 0) {
          // If there are arg tokens, replace this placeholder with them
          for (let i = 0; i < argTokens.length; i++) {
            const argToken = argTokens[i]!;
            const spaceBefore = i === 0 ? " ".repeat(token.start - lastTokenEnd) : "";
            expandedText += spaceBefore + argToken.lexeme;
            const callSiteToken = "callSiteToken" in argToken
              ? (argToken as ExpandedToken).callSiteToken
              : argToken;
            expandedTokens.push({
              ...argToken,
              start: expandedText.length - argToken.lexeme.length,
              callSiteToken
            });
          }
        } else {
          // Empty argument, skip
        }
        lastTokenEnd = token.end;
      } else {
        const spaceBefore = " ".repeat(token.start - lastTokenEnd);
        expandedText += spaceBefore + token.lexeme;
        expandedTokens.push({
          ...token,
          start: expandedText.length - token.lexeme.length,
          callSiteToken: null
        });
        lastTokenEnd = token.end;
      }
    }

    // Add leading spaces to approximate the original indentation
    const indentMatch = /^\s+/.exec(bodyLine.node.text);
    const indent = indentMatch ? indentMatch[0] : "";
    const finalText = indent + expandedText;

    // Shift tokens by indent length
    const shiftedTokens = expandedTokens.map(t => ({
      ...t,
      start: t.start + indent.length
    }));

    lines.push({
      text: finalText,
      tokens: shiftedTokens
    });
  }

  const parsedLines = lines.map(line => parseLexedLine({ line: 0, text: line.text, tokens: line.tokens }));

  const result = { lines, parsedLines };
  macroExpansionCache.set(callLine, { definition, expansion: result });
  return result;
}


export function splitMacroCallArguments(tokens: readonly Token[]): readonly (readonly Token[])[] {
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

    if (token.kind === "expressionOperator" && token.lexeme === ";" && depth === 0) {
      argumentsByIndex.push([]);
      continue;
    }

    argumentsByIndex.at(-1)?.push(token);
  }

  return argumentsByIndex;
}

export function getActiveMacroCallArgumentIndex(tokens: readonly Token[], character: number): number {
  let activeArgumentIndex = 0;
  let depth = 0;

  for (const token of tokens) {
    if (token.start >= character) {
      break;
    }

    if (token.kind !== "expressionOperator") {
      continue;
    }

    if (token.lexeme === "(") {
      depth += 1;
      continue;
    }

    if (token.lexeme === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (token.lexeme === ";" && depth === 0) {
      activeArgumentIndex += 1;
    }
  }

  return activeArgumentIndex;
}

export type EffectiveLine = {
  line: number;
  node: ParsedLine;
  isExpanded: boolean;
};

type ExpansionCacheEntry = {
  resolvedDefinitions: Map<string, MacroDefinitionRegion | undefined>;
  effectiveLines: readonly EffectiveLine[];
};

const effectiveLinesCache = new WeakMap<ParsedDocument, ExpansionCacheEntry>();

export function getEffectiveLines(
  document: ParsedDocument,
  macroDefinitions: readonly MacroDefinitionRegion[]
): readonly EffectiveLine[] {
  const cached = effectiveLinesCache.get(document);
  let canReuseCache = false;

  if (cached) {
    canReuseCache = true;
    for (const macroCall of document.macroCalls) {
      const macroName = macroCall.macro.lexeme;
      const currentDefinition = macroDefinitions.find((def) => def.name === macroName);
      if (cached.resolvedDefinitions.get(macroName) !== currentDefinition) {
        canReuseCache = false;
        break;
      }
    }
  }

  if (canReuseCache && cached) {
    return cached.effectiveLines;
  }

  const resolvedDefinitions = new Map<string, MacroDefinitionRegion | undefined>();
  for (const macroCall of document.macroCalls) {
    const macroName = macroCall.macro.lexeme;
    if (!resolvedDefinitions.has(macroName)) {
      const definition = macroDefinitions.find((def) => def.name === macroName);
      resolvedDefinitions.set(macroName, definition);
    }
  }

  const effectiveLines: EffectiveLine[] = [];

  function expandNode(
    node: ParsedLine,
    sourceLine: number,
    depth: number,
    callStack: ReadonlySet<string>,
    budget: { remaining: number }
  ) {
    const isExpanded = depth > 0;
    if (isExpanded) {
      if (budget.remaining <= 0) {
        return;
      }
      budget.remaining -= 1;
    }

    effectiveLines.push({
      line: sourceLine,
      node,
      isExpanded
    });

    if (node.shape === "macroCall") {
      const macroName = node.macro.lexeme;
      if (callStack.has(macroName) || depth >= MAX_MACRO_EXPANSION_DEPTH) {
        return;
      }

      const expansion = expandMacroCall(node, macroDefinitions);
      const newStack = new Set(callStack);
      newStack.add(macroName);

      for (const parsedLine of expansion.parsedLines) {
        expandNode(parsedLine, sourceLine, depth + 1, newStack, budget);
      }
    }
  }

  for (const line of document.lines) {
    expandNode(line.node, line.line, 0, new Set(), { remaining: MAX_MACRO_EXPANSION_LINES });
  }

  effectiveLinesCache.set(document, { resolvedDefinitions, effectiveLines });
  return effectiveLines;
}
