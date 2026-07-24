import { type Token } from "./lexer";

export type NumericLiteralExpression = {
  kind: "numericLiteral";
  value: string;
};

export type IdentifierExpression = {
  kind: "identifier";
  value: string;
  token: Token;
};

export type StringExpression = {
  kind: "string";
  value: string;
  token: Token;
};

export type CurrentAddressExpression = {
  kind: "currentAddress";
};

export type ModifierExpression = {
  kind: "modifier";
  operator: "<" | ">" | "^";
  expression: Expression;
};

export type UnaryExpression = {
  kind: "unary";
  operator: "+" | "-";
  expression: Expression;
};

export type BinaryExpression = {
  kind: "binary";
  operator: "+" | "-" | "*" | "/";
  left: Expression;
  right: Expression;
};

export type Expression =
  | NumericLiteralExpression
  | IdentifierExpression
  | StringExpression
  | CurrentAddressExpression
  | ModifierExpression
  | UnaryExpression
  | BinaryExpression;

export type ParsedExpression = {
  expression: Expression;
  nextTokenIndex: number;
};

export type ParsedOperand = {
  operand: Operand;
  nextTokenIndex: number;
};

export type Operand = {
  immediate: boolean;
  indirect: boolean;
  indexRegister: "x" | "y" | null;
  indexPosition?: "inside" | "outside" | null;
  expression: Expression;
};

const binaryPrecedence = new Map<string, number>([
  ["+", 10],
  ["-", 10],
  ["*", 20],
  ["/", 20]
]);

export function parseExpression(
  tokens: readonly Token[],
  startIndex = 0,
  minimumPrecedence = 0
): ParsedExpression {
  let { expression: left, nextTokenIndex } = parsePrefix(tokens, startIndex);

  while (nextTokenIndex < tokens.length) {
    const operatorToken = tokens[nextTokenIndex];
    if (operatorToken?.kind !== "expressionOperator") {
      break;
    }

    const precedence = binaryPrecedence.get(operatorToken.lexeme);
    if (precedence === undefined || precedence < minimumPrecedence) {
      break;
    }

    const parsedRight = parseExpression(tokens, nextTokenIndex + 1, precedence + 1);
    left = {
      kind: "binary",
      operator: operatorToken.lexeme as BinaryExpression["operator"],
      left,
      right: parsedRight.expression
    };
    nextTokenIndex = parsedRight.nextTokenIndex;
  }

  return {
    expression: left,
    nextTokenIndex
  };
}

export function parseOperand(tokens: readonly Token[], startIndex = 0): ParsedOperand {
  let index = startIndex;
  let immediate = false;
  let indirect = false;
  let indexRegister: Operand["indexRegister"] = null;
  let indexPosition: Operand["indexPosition"] = null;

  if (tokens[index]?.kind === "expressionOperator" && tokens[index]?.lexeme === "#") {
    immediate = true;
    index += 1;
  }

  if (tokens[index]?.kind === "numericLiteral" && tokens[index]?.lexeme.startsWith("#")) {
    immediate = true;
    const token = tokens[index];
    const expression: NumericLiteralExpression = {
      kind: "numericLiteral",
      value: token.lexeme.slice(1)
    };
    return {
      operand: {
        immediate,
        indirect,
        indexRegister,
        indexPosition,
        expression
      },
      nextTokenIndex: index + 1
    };
  }

  let parsedExpression: ParsedExpression;

  if (tokens[index]?.kind === "expressionOperator" && tokens[index]?.lexeme === "(") {
    indirect = true;
    parsedExpression = parseExpression(tokens, index + 1);
    index = parsedExpression.nextTokenIndex;

    if (tokens[index]?.kind === "expressionOperator" && tokens[index]?.lexeme === ",") {
      indexRegister = parseIndexRegister(tokens[index + 1]);
      indexPosition = "inside";
      index += 2;
    }

    expectOperator(tokens[index], ")");
    index += 1;

    if (tokens[index]?.kind === "expressionOperator" && tokens[index]?.lexeme === ",") {
      if (indexRegister !== null) {
        throw new Error("unexpected second index register");
      }
      indexRegister = parseIndexRegister(tokens[index + 1]);
      indexPosition = "outside";
      index += 2;
    }
  } else {
    parsedExpression = parseExpression(tokens, index);
    index = parsedExpression.nextTokenIndex;

    if (tokens[index]?.kind === "expressionOperator" && tokens[index]?.lexeme === ",") {
      indexRegister = parseIndexRegister(tokens[index + 1]);
      indexPosition = "outside";
      index += 2;
    }
  }

  return {
    operand: {
      immediate,
      indirect,
      indexRegister,
      indexPosition,
      expression: parsedExpression.expression
    },
    nextTokenIndex: index
  };
}

function parsePrefix(tokens: readonly Token[], startIndex: number): ParsedExpression {
  const token = tokens[startIndex];
  if (token === undefined) {
    throw new Error("expected expression token");
  }

  if (token.kind === "numericLiteral") {
    return {
      expression: {
        kind: "numericLiteral",
        value: token.lexeme
      },
      nextTokenIndex: startIndex + 1
    };
  }



  if (
    token.kind === "identifier" || 
    token.kind === "label" || 
    token.kind === "localLabel" || 
    token.kind === "mnemonic" || 
    token.kind === "directive"
  ) {
    return {
      expression: {
        kind: "identifier",
        value: token.lexeme,
        token
      },
      nextTokenIndex: startIndex + 1
    };
  }

  if (token.kind === "string") {
    return {
      expression: {
        kind: "string",
        value: token.lexeme.slice(1, -1),
        token
      },
      nextTokenIndex: startIndex + 1
    };
  }

  if (token.kind === "expressionOperator" && token.lexeme === "*") {
    return {
      expression: {
        kind: "currentAddress"
      },
      nextTokenIndex: startIndex + 1
    };
  }

  if (token.kind === "modifier") {
    const parsedInner = parsePrefix(tokens, startIndex + 1);
    return {
      expression: {
        kind: "modifier",
        operator: token.lexeme as ModifierExpression["operator"],
        expression: parsedInner.expression
      },
      nextTokenIndex: parsedInner.nextTokenIndex
    };
  }

  if (token.kind === "expressionOperator" && token.lexeme === "(") {
    const parsedInner = parseExpression(tokens, startIndex + 1);
    expectOperator(tokens[parsedInner.nextTokenIndex], ")");
    return {
      expression: parsedInner.expression,
      nextTokenIndex: parsedInner.nextTokenIndex + 1
    };
  }

  if (token.kind === "expressionOperator" && (token.lexeme === "+" || token.lexeme === "-")) {
    const parsedInner = parsePrefix(tokens, startIndex + 1);
    return {
      expression: {
        kind: "unary",
        operator: token.lexeme as UnaryExpression["operator"],
        expression: parsedInner.expression
      },
      nextTokenIndex: parsedInner.nextTokenIndex
    };
  }

  if (token.kind === "expressionOperator" && token.lexeme === "#") {
    return parsePrefix(tokens, startIndex + 1);
  }

  throw new Error(`unexpected expression token: ${token.lexeme}`);
}

function expectOperator(token: Token | undefined, lexeme: string): void {
  if (token?.kind !== "expressionOperator" || token.lexeme !== lexeme) {
    throw new Error(`expected operator ${lexeme}`);
  }
}

function parseIndexRegister(token: Token | undefined): Operand["indexRegister"] {
  const normalized = token?.lexeme.toLowerCase();
  if (token?.kind === "identifier" && (normalized === "x" || normalized === "y")) {
    return normalized;
  }

  throw new Error("expected index register");
}
