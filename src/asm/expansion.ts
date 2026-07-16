import { stripTrailingComment } from "./parser";
import { type MacroCallLine, type MacroDefinitionRegion, type ParsedLine, parseLexedLine } from "./parser";
import { type Token } from "./lexer";
import { type ParsedDocument } from "./document";

export type ExpandedToken = Token & {
  sourceToken: Token;
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

  // Use the substitution logic we already have?
  // buildMacroSubstitution requires a ParsedDocument, which requires full ast.
  // We can just extract the argument tokens here instead.

  const args: Token[][] = [];
  let currentArg: Token[] = [];
  let depth = 0;
  for (const token of callLine.args) {
    if (token.kind === "expressionOperator" && token.lexeme === "(") {
      depth++;
      currentArg.push(token);
    } else if (token.kind === "expressionOperator" && token.lexeme === ")") {
      depth = Math.max(0, depth - 1);
      currentArg.push(token);
    } else if (token.kind === "expressionOperator" && token.lexeme === "," && depth === 0) {
      args.push(currentArg);
      currentArg = [];
    } else {
      currentArg.push(token);
    }
  }
  if (currentArg.length > 0 || callLine.args.length > 0) {
    args.push(currentArg);
  }

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
        const argTokens = args[paramIndex - 1] ?? [];
        if (argTokens.length > 0) {
          // If there are arg tokens, replace this placeholder with them
          for (let i = 0; i < argTokens.length; i++) {
            const argToken = argTokens[i]!;
            const spaceBefore = i === 0 ? " ".repeat(token.start - lastTokenEnd) : "";
            expandedText += spaceBefore + argToken.lexeme;
            expandedTokens.push({
              ...argToken,
              start: expandedText.length - argToken.lexeme.length,
              sourceToken: argToken // Maps back to call site argument
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
          sourceToken: token // Maps back to macro definition body
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

    if (token.kind === "expressionOperator" && token.lexeme === "," && depth === 0) {
      argumentsByIndex.push([]);
      continue;
    }

    argumentsByIndex.at(-1)?.push(token);
  }

  return argumentsByIndex;
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

  function expandNode(node: ParsedLine, sourceLine: number, depth: number, callStack: ReadonlySet<string>) {
    if (node.shape === "macroCall") {
      effectiveLines.push({
        line: sourceLine,
        node,
        isExpanded: depth > 0
      });

      const macroName = node.macro.lexeme;
      if (callStack.has(macroName) || depth >= 50) {
        return;
      }

      const expansion = expandMacroCall(node, macroDefinitions);
      const newStack = new Set(callStack);
      newStack.add(macroName);

      for (const parsedLine of expansion.parsedLines) {
        expandNode(parsedLine, sourceLine, depth + 1, newStack);
      }
    } else {
      effectiveLines.push({
        line: sourceLine,
        node,
        isExpanded: depth > 0
      });
    }
  }

  for (const line of document.lines) {
    expandNode(line.node, line.line, 0, new Set());
  }

  effectiveLinesCache.set(document, { resolvedDefinitions, effectiveLines });
  return effectiveLines;
}
