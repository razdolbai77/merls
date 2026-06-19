import { directiveTable } from "./metadata";
import { type Expression, type Operand, parseExpression, parseOperand } from "./expression";
import { type LexedLine, lexSource, type Token } from "./lexer";

export type ParsedLine =
  | EmptyLine
  | CommentLine
  | LabelOnlyLine
  | EquateLine
  | InstructionLine
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
  comment: string;
};

export type LabelOnlyLine = {
  shape: "labelOnly";
  text: string;
  label: string;
};

export type EquateLine = {
  shape: "equate";
  text: string;
  label: string;
  expression: Expression;
};

export type InstructionLine = {
  shape: "instruction";
  text: string;
  label: string | null;
  mnemonic: string;
  operand: Operand | null;
};

export type DirectiveLine = {
  shape: "directive";
  text: string;
  label: string | null;
  directive: string;
  operand: Expression | null;
};

export type DataLine = {
  shape: "data";
  text: string;
  label: string | null;
  directive: string;
  payload: string;
};

export type MalformedLine = {
  shape: "malformed";
  text: string;
  message: string;
};

const dataDirectiveKinds = new Set(["data"]);

export function parseSourceLines(source: string): readonly ParsedLine[] {
  return lexSource(source).lines.map(parseLexedLine);
}

export function parseLexedLine(line: LexedLine): ParsedLine {
  const tokens = stripTrailingComment(line.tokens);

  if (tokens.length === 0) {
    const commentToken = line.tokens[0];
    if (commentToken?.kind === "comment") {
      return {
        shape: "commentOnly",
        text: line.text,
        comment: commentToken.lexeme
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
  let label: string | null = null;

  if (tokens[index]?.kind === "label" || tokens[index]?.kind === "localLabel") {
    label = tokens[index]?.lexeme ?? null;
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

  if (token.kind === "expressionOperator" && token.lexeme === "=") {
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
      mnemonic: token.lexeme.toLowerCase(),
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
        directive: token.lexeme.toLowerCase(),
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
      directive: directiveName,
      operand
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
