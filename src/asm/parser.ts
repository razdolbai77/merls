import { directiveTable } from "./metadata";
import { type Expression, type Operand, parseExpression, parseOperand } from "./expression";
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

export type MacroBodyLine = {
  line: number;
  node: ParsedLine;
  parameterReferences: readonly MacroParameterReference[];
};

export type MacroDefinitionRegion = {
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

export type ParsedSourceStructure = {
  lines: readonly ParsedLine[];
  macroDefinitions: readonly MacroDefinitionRegion[];
};

const dataDirectiveKinds = new Set(["data"]);

export function parseSourceLines(source: string | LexedSource): readonly ParsedLine[] {
  const lexed = typeof source === "string" ? lexSource(source) : source;
  return lexed.lines.map(parseLexedLine);
}

export function parseSourceStructure(source: string | LexedSource): ParsedSourceStructure {
  const lexed = typeof source === "string" ? lexSource(source) : source;
  const lines = lexed.lines.map(parseLexedLine);

  return {
    lines,
    macroDefinitions: collectMacroDefinitionRegions(lines)
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
    index += 1;
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
    return {
      shape: "equate",
      text,
      label,
      expression: parsed.expression
    };
  }

  if (token.kind === "mnemonic") {
    const operandTokens = tokens.slice(index + 1);
    const operand = operandTokens.length > 0 ? parseOperand(operandTokens).operand : null;
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
      return {
        shape: "data",
        text,
        label,
        directive: token,
        payload: tokens.slice(index + 1).map((current) => current.lexeme).join("")
      };
    }

    const operandTokens = tokens.slice(index + 1);
    const directiveName = token.lexeme.toLowerCase();

    if (operandTokens.length > 0 && (directiveName === "end" || directiveName === "dend" || directiveName === "xc")) {
      throw new Error(`unexpected operand for ${directiveName}`);
    }

    const operand = operandTokens.length > 0
      ? parseExpression(operandTokens).expression
      : null;
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

function stripTrailingComment(tokens: readonly Token[]): readonly Token[] {
  const commentIndex = tokens.findIndex((token) => token.kind === "comment");
  if (commentIndex === -1) {
    return tokens;
  }

  return tokens.slice(0, commentIndex);
}

function collectMacroDefinitionRegions(lines: readonly ParsedLine[]): readonly MacroDefinitionRegion[] {
  const macroDefinitions: MacroDefinitionRegion[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const startNode = lines[index];

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
      const currentNode = lines[bodyIndex];

      if (
        currentNode?.shape === "directive" &&
        (currentNode.directive.lexeme.toLowerCase() === "eom" ||
          currentNode.directive.lexeme === "<<<")
      ) {
        endLine = bodyIndex;
        endDirective = currentNode.directive;
        break;
      }

      const bodyParameterReferences = collectMacroParameterReferences(currentNode);
      parameterReferences.push(...bodyParameterReferences);
      body.push({
        line: bodyIndex,
        node: currentNode,
        parameterReferences: bodyParameterReferences
      });
    }

    macroDefinitions.push({
      name: startNode.label.lexeme,
      nameToken: startNode.label,
      startLine: index,
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

function collectMacroParameterReferences(node: ParsedLine): readonly MacroParameterReference[] {
  const tokens = collectNodeTokens(node);
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

function collectNodeTokens(node: ParsedLine): readonly Token[] {
  switch (node.shape) {
    case "equate":
      return [node.label, ...collectExpressionTokens(node.expression)];
    case "instruction":
      return [
        ...(node.label !== null ? [node.label] : []),
        node.mnemonic,
        ...(node.operand !== null ? collectOperandTokens(node.operand) : [])
      ];
    case "macroCall":
      return [
        ...(node.label !== null ? [node.label] : []),
        node.macro,
        ...node.args
      ];
    case "directive":
      return [
        ...(node.label !== null ? [node.label] : []),
        node.directive,
        ...(node.operand !== null ? collectExpressionTokens(node.operand) : [])
      ];
    case "data":
      return [
        ...(node.label !== null ? [node.label] : []),
        node.directive
      ];
    case "labelOnly":
      return [node.label];
    case "commentOnly":
      return [node.comment];
    default:
      return [];
  }
}

function collectOperandTokens(operand: Operand): readonly Token[] {
  const tokens = collectExpressionTokens(operand.expression);

  return [
    ...(operand.immediate ? [{ kind: "expressionOperator", lexeme: "#", start: -1, end: -1 } as Token] : []),
    ...tokens
  ];
}

function collectExpressionTokens(expression: Expression): readonly Token[] {
  switch (expression.kind) {
    case "identifier":
      return [expression.token];
    case "modifier":
      return [
        { kind: "modifier", lexeme: expression.operator, start: -1, end: -1 } as Token,
        ...collectExpressionTokens(expression.expression)
      ];
    case "unary":
      return collectExpressionTokens(expression.expression);
    case "binary":
      return [
        ...collectExpressionTokens(expression.left),
        ...collectExpressionTokens(expression.right)
      ];
    default:
      return [];
  }
}
