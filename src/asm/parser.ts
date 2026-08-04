import { directiveTable } from "./metadata";
import { macroParameterPattern } from "./macros";
import { type Expression, type Operand, parseExpression, parseOperand, walkExpression } from "./expression";
import { lexSource, type LexedLine, type LexedSource, type Token } from "./lexer";

export type ParsedLine =
  | EmptyLine
  | CommentLine
  | LabelOnlyLine
  | EquateLine
  | InstructionLine
  | MacroCallLine
  | DirectiveLine
  | DataLine
  | MalformedLine;

export type EmptyLine = {
  shape: "empty";
  text: string;
};

export type CommentLine = {
  shape: "commentOnly";
  text: string;
  comment: Token;
};

export type LabelOnlyLine = {
  shape: "labelOnly";
  text: string;
  label: Token;
};

export type EquateLine = {
  shape: "equate";
  text: string;
  label: Token;
  isVariable: boolean;
  expression: Expression;
};

export type InstructionLine = {
  shape: "instruction";
  text: string;
  label: Token | null;
  mnemonic: Token;
  operand: Operand | null;
};

export type MacroCallLine = {
  shape: "macroCall";
  text: string;
  label: Token | null;
  macro: Token;
  args: readonly Token[];
};

export type DirectiveLine = {
  shape: "directive";
  text: string;
  label: Token | null;
  directive: Token;
  operand: Expression | null;
};

export type DataLine = {
  shape: "data";
  text: string;
  label: Token | null;
  directive: Token;
  payload: string;
  tokens: readonly Token[];
};

export type MalformedLine = {
  shape: "malformed";
  text: string;
  message: string;
};

export type MacroParameterReference = {
  token: Token;
  index: number;
};

export type MacroSymbolReference = {
  token: Token;
};

export type MacroNestedCall = {
  macro: Token;
  args: readonly Token[];
};

export type MacroLocalLabelDefinition = {
  token: Token;
};

export type MacroLocalLabelReference = {
  token: Token;
};

export type MacroBodyLine = {
  line: number;
  node: ParsedLine;
  tokens: readonly Token[];
  parameterReferences: readonly MacroParameterReference[];
  symbolReferences: readonly MacroSymbolReference[];
  nestedMacroCalls: readonly MacroNestedCall[];
  localLabelDefinitions: readonly MacroLocalLabelDefinition[];
  localLabelReferences: readonly MacroLocalLabelReference[];
};

export type MacroDefinitionRegion = {
  name: string;
  nameToken: Token;
  startLine: number;
  endLine: number | null;
  startDirective: Token;
  endDirective: Token | null;
  body: readonly MacroBodyLine[];
  nestedDefinitions?: readonly MacroDefinitionRegion[];
  parameterReferences: readonly MacroParameterReference[];
  symbolReferences: readonly MacroSymbolReference[];
  nestedMacroCalls: readonly MacroNestedCall[];
  localLabelDefinitions: readonly MacroLocalLabelDefinition[];
  localLabelReferences: readonly MacroLocalLabelReference[];
  maxParameterIndex: number;
};

type MacroStartNode = Extract<ParsedLine, { shape: "directive" }> & {
  label: Token;
};

export type ParsedSourceStructure = {
  lines: readonly ParsedLine[];
  macroDefinitions: readonly MacroDefinitionRegion[];
};

const dataDirectiveKinds = new Set(["data"]);

export function isAssemblyEndDirective(node: ParsedLine): boolean {
  return node.shape === "directive" && node.directive.lexeme.toLowerCase() === "end";
}

export function getAssemblyEndLine(lines: readonly ParsedLine[]): number | null {
  const endLine = lines.findIndex(isAssemblyEndDirective);
  return endLine === -1 ? null : endLine;
}

export function parseSourceLines(source: string | LexedSource): readonly ParsedLine[] {
  const lexed = typeof source === "string" ? lexSource(source) : source;
  return lexed.lines.map(parseLexedLine);
}

export function parseSourceStructure(source: string | LexedSource): ParsedSourceStructure {
  const lexed = typeof source === "string" ? lexSource(source) : source;
  const lines = lexed.lines.map(parseLexedLine);

  return {
    lines,
    macroDefinitions: collectMacroDefinitionRegions(lines, lexed.lines)
  };
}

export function parseLexedLine(line: LexedLine): ParsedLine {
  const tokens = stripTrailingComment(line.tokens);

  if (tokens.length === 0) {
    const commentToken = line.tokens[0];
    if (commentToken?.kind === "comment") {
      return {
        shape: "commentOnly",
        text: line.text,
        comment: commentToken
      };
    }

    return {
      shape: "empty",
      text: line.text
    };
  }

  try {
    return parseStructuredLine(line.text, tokens);
  } catch (error) {
    return {
      shape: "malformed",
      text: line.text,
      message: error instanceof Error ? error.message : "unknown parse failure"
    };
  }
}

function parseStructuredLine(text: string, tokens: readonly Token[]): ParsedLine {
  let index = 0;
  let label: Token | null = null;

  if (tokens[index]?.kind === "label" || tokens[index]?.kind === "localLabel") {
    label = tokens[index] ?? null;
    index++;
  }

  const token = tokens[index];
  if (token === undefined) {
    if (label !== null) {
      return {
        shape: "labelOnly",
        text,
        label
      };
    }

    return {
      shape: "empty",
      text
    };
  }

  if (
    (token.kind === "expressionOperator" && token.lexeme === "=") ||
    (token.kind === "directive" && token.lexeme.toLowerCase() === "equ")
  ) {
    if (label === null) {
      throw new Error("equate requires a label");
    }

    const parsed = parseExpression(tokens, index + 1);
    if (parsed.nextTokenIndex < tokens.length) {
      throw new Error(`unexpected token after equate expression: ${tokens[parsed.nextTokenIndex]?.lexeme}`);
    }
    return {
      shape: "equate",
      text,
      label,
      isVariable: label.lexeme.startsWith("]"),
      expression: parsed.expression
    };
  }

  if (token.kind === "mnemonic") {
    const operandTokens = tokens.slice(index + 1);
    let operand = null;
    if (operandTokens.length > 0) {
      const parsed = parseOperand(operandTokens);
      if (parsed.nextTokenIndex < operandTokens.length) {
        throw new Error(`unexpected token after instruction operand: ${operandTokens[parsed.nextTokenIndex]?.lexeme}`);
      }
      operand = parsed.operand;
    }
    return {
      shape: "instruction",
      text,
      label,
      mnemonic: token,
      operand
    };
  }

  if (token.kind === "directive") {
    const directive = directiveTable.get(token.lexeme.toLowerCase());
    if (directive !== undefined && dataDirectiveKinds.has(directive.kind)) {
      const payloadTokens = tokens.slice(index + 1);
      return {
        shape: "data",
        text,
        label,
        directive: token,
        payload: payloadTokens.map((current) => current.lexeme).join(""),
        tokens: payloadTokens
      };
    }

    const operandTokens = tokens.slice(index + 1);
    const directiveName = token.lexeme.toLowerCase();

    if (operandTokens.length > 0 && (directiveName === "end" || directiveName === "dend" || directiveName === "xc")) {
      throw new Error(`unexpected operand for ${directiveName}`);
    }

    let operand = null;
    if (operandTokens.length > 0) {
      const parsed = parseExpression(operandTokens);
      if (parsed.nextTokenIndex < operandTokens.length) {
        throw new Error(`unexpected token after directive operand: ${operandTokens[parsed.nextTokenIndex]?.lexeme}`);
      }
      operand = parsed.expression;
    }
    return {
      shape: "directive",
      text,
      label,
      directive: token,
      operand
    };
  }

  if (token.kind === "identifier") {
    return {
      shape: "macroCall",
      text,
      label,
      macro: token,
      args: tokens.slice(index + 1)
    };
  }

  throw new Error(`unsupported line start: ${token.lexeme}`);
}
export function stripTrailingComment(tokens: readonly Token[]): readonly Token[] {
  const commentIndex = tokens.findIndex((token) => token.kind === "comment");
  if (commentIndex === -1) {
    return tokens;
  }

  return tokens.slice(0, commentIndex);
}

function collectMacroDefinitionRegions(lines: readonly ParsedLine[], lexedLines: readonly LexedLine[]): readonly MacroDefinitionRegion[] {
  const macroDefinitions: MacroDefinitionRegion[] = [];

  for (let index = 0; index < lines.length; index++) {
    const startNode = lines[index];
    if (startNode !== undefined && isAssemblyEndDirective(startNode)) break;
    if (!isMacroDefinitionStart(startNode)) continue;

    const macroDefinition = collectMacroDefinitionRegion(lines, lexedLines, index, startNode);
    macroDefinitions.push(macroDefinition);
    if (macroDefinition.endLine === null) break;
    index = macroDefinition.endLine;
  }
  return macroDefinitions;
}

function collectMacroDefinitionRegion(
  lines: readonly ParsedLine[],
  lexedLines: readonly LexedLine[],
  startLine: number,
  startNode: MacroStartNode
): MacroDefinitionRegion {
  const body: MacroBodyLine[] = [];
  const nestedDefinitions: MacroDefinitionRegion[] = [];
  const parameterReferences: MacroParameterReference[] = [];
  const symbolReferences: MacroSymbolReference[] = [];
  const nestedMacroCalls: MacroNestedCall[] = [];
  const localLabelDefinitions: MacroLocalLabelDefinition[] = [];
  const localLabelReferences: MacroLocalLabelReference[] = [];
  let endLine: number | null = null;
  let endDirective: Token | null = null;

  for (let bodyIndex = startLine + 1; bodyIndex < lines.length; bodyIndex++) {
    const currentNode = lines[bodyIndex];
    if (isMacroTerminator(currentNode)) {
      endLine = bodyIndex;
      endDirective = currentNode.directive;
      break;
    }
    if (isMacroDefinitionStart(currentNode)) {
      const nestedDefinition = collectMacroDefinitionRegion(lines, lexedLines, bodyIndex, currentNode);
      nestedDefinitions.push(nestedDefinition);
      if (nestedDefinition.endLine === null) break;
      bodyIndex = nestedDefinition.endLine;
      continue;
    }

    const bodyUsage = collectMacroBodyUsage(currentNode);
    parameterReferences.push(...bodyUsage.parameterReferences);
    symbolReferences.push(...bodyUsage.symbolReferences);
    nestedMacroCalls.push(...bodyUsage.nestedMacroCalls);
    localLabelDefinitions.push(...bodyUsage.localLabelDefinitions);
    localLabelReferences.push(...bodyUsage.localLabelReferences);
    body.push({
      line: bodyIndex,
      node: currentNode,
      tokens: lexedLines[bodyIndex]?.tokens ?? [],
      ...bodyUsage
    });
  }

  return {
    name: startNode.label.lexeme,
    nameToken: startNode.label,
    startLine,
    endLine,
    startDirective: startNode.directive,
    endDirective,
    body,
    ...(nestedDefinitions.length > 0 ? { nestedDefinitions } : {}),
    parameterReferences,
    symbolReferences,
    nestedMacroCalls,
    localLabelDefinitions,
    localLabelReferences,
    maxParameterIndex: parameterReferences.reduce(
      (max, parameterReference) => Math.max(max, parameterReference.index),
      0
    )
  };
}

function isMacroDefinitionStart(node: ParsedLine | undefined): node is MacroStartNode {
  return (
    node?.shape === "directive" &&
    node.label !== null &&
    node.directive.lexeme.toLowerCase() === "mac"
  );
}

function isMacroTerminator(node: ParsedLine | undefined): node is Extract<ParsedLine, { shape: "directive" }> {
  return (
    node?.shape === "directive" &&
    (node.directive.lexeme.toLowerCase() === "eom" || node.directive.lexeme === "<<<")
  );
}
function collectMacroBodyUsage(node: ParsedLine): Omit<MacroBodyLine, "line" | "node" | "tokens"> {
  const parameterReferences: MacroParameterReference[] = [];
  const symbolReferences: MacroSymbolReference[] = [];
  const nestedMacroCalls: MacroNestedCall[] = [];
  const localLabelDefinitions: MacroLocalLabelDefinition[] = [];
  const localLabelReferences: MacroLocalLabelReference[] = [];

  const collectTokenUsage = (token: Token): void => {
    const match = macroParameterPattern.exec(token.lexeme);
    if (token.kind === "localLabel" && match !== null) {
      parameterReferences.push({
        token,
        index: Number.parseInt(match[1] ?? "0", 10)
      });
      return;
    }

    if (token.kind === "localLabel") {
      localLabelReferences.push({ token });
      return;
    }

    if (token.kind === "identifier" || token.kind === "label") {
      symbolReferences.push({ token });
    }
  };

  switch (node.shape) {
    case "macroCall":
      if (node.label?.kind === "localLabel") {
        localLabelDefinitions.push({ token: node.label });
      }
      nestedMacroCalls.push({
        macro: node.macro,
        args: node.args
      });
      node.args.forEach(collectTokenUsage);
      break;
    case "instruction":
      if (node.label?.kind === "localLabel") {
        localLabelDefinitions.push({ token: node.label });
      }
      if (node.operand !== null) {
        collectExpressionUsage(node.operand.expression, collectTokenUsage);
      }
      break;
    case "equate":
      if (node.label.kind === "localLabel" && !node.isVariable) {
        localLabelDefinitions.push({ token: node.label });
      }
      collectExpressionUsage(node.expression, collectTokenUsage);
      break;
    case "directive":
      if (node.label?.kind === "localLabel") {
        localLabelDefinitions.push({ token: node.label });
      }
      if (node.operand !== null) {
        collectExpressionUsage(node.operand, collectTokenUsage);
      }
      break;
    case "labelOnly":
      if (node.label.kind === "localLabel") {
        localLabelDefinitions.push({ token: node.label });
      }
      break;
    case "data":
      if (node.label?.kind === "localLabel") {
        localLabelDefinitions.push({ token: node.label });
      }
      node.tokens.forEach(collectTokenUsage);
      break;
    default:
      break;
  }

  return {
    parameterReferences,
    symbolReferences,
    nestedMacroCalls,
    localLabelDefinitions,
    localLabelReferences
  };
}

function collectExpressionUsage(expression: Expression, collectTokenUsage: (token: Token) => void): void {
  walkExpression(expression, (identifier) => collectTokenUsage(identifier.token));
}
