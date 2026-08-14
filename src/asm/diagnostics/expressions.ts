import { type ParsedDocument } from "../document";
import { type Expression } from "../expression";
import { isAssemblyEndDirective, type ParsedLine } from "../parser";

type ConditionalBranch = {
  parentIsActive: boolean;
  condition: boolean | null;
};

export function collectActiveLines(
  document: ParsedDocument,
  values: Map<string, number>
): ReadonlySet<number> {
  const activeLines = new Set<number>();
  const branches: ConditionalBranch[] = [];
  let isActive = true;

  for (const line of document.lines) {
    if (isActive && isAssemblyEndDirective(line.node)) {
      activeLines.add(line.line);
      break;
    }
    const directiveName = line.node.shape === "directive"
      ? line.node.directive.lexeme.toLowerCase()
      : null;

    if (directiveName === "do" || directiveName === "if") {
      if (isActive) {
        activeLines.add(line.line);
      }
      const operand = line.node.shape === "directive" ? line.node.operand : null;
      const value: number | null = isActive && operand !== null
        ? evaluateExpression(operand, values)
        : null;
      const condition: boolean | null = value === null ? null : value !== 0;
      branches.push({ parentIsActive: isActive, condition });
      isActive = isActive && condition !== false;
      continue;
    }

    if (directiveName === "else") {
      const branch = branches.at(-1);
      if (branch?.parentIsActive === true) {
        activeLines.add(line.line);
      }
      if (branch !== undefined) {
        isActive = branch.parentIsActive && branch.condition !== true;
      }
      continue;
    }

    if (directiveName === "fin") {
      const branch = branches.pop();
      if (branch?.parentIsActive === true) {
        activeLines.add(line.line);
      }
      if (branch !== undefined) {
        isActive = branch.parentIsActive;
      }
      continue;
    }

    if (!isActive) {
      continue;
    }
    activeLines.add(line.line);
    recordConditionalValue(line.node, values);
  }

  return activeLines;
}

export function recordConditionalValue(node: ParsedLine, values: Map<string, number>): void {
  if (node.shape !== "equate") {
    return;
  }

  const value = evaluateExpression(node.expression, values);
  if (value === null) {
    return;
  }
  if (node.isVariable || !values.has(node.label.lexeme)) {
    values.set(node.label.lexeme, value);
  }
}

export function evaluateExpression(expression: Expression, values: ReadonlyMap<string, number>): number | null {
  switch (expression.kind) {
    case "numericLiteral":
      return parseNumericLiteral(expression.value);
    case "identifier":
      return values.get(expression.value) ?? null;
    case "modifier": {
      const value = evaluateExpression(expression.expression, values);
      if (value === null || !Number.isSafeInteger(value)) {
        return null;
      }
      switch (expression.operator) {
        case "<":
          return value & 0xff;
        case ">":
          return (value >> 8) & 0xff;
        case "^":
          return (value >> 16) & 0xff;
      }
      return null;
    }
    case "unary": {
      const value = evaluateExpression(expression.expression, values);
      if (value === null) {
        return null;
      }
      return expression.operator === "+" ? value : -value;
    }
    case "binary":
      return evaluateBinaryExpression(expression, values);
    default:
      return null;
  }
}

export function parseNumericLiteral(value: string): number | null {
  const radix = value.startsWith("$") ? 16 : value.startsWith("%") ? 2 : 10;
  const text = radix === 16 || radix === 2 ? value.slice(1).replace(/_/gu, "") : value;
  const parsed = Number.parseInt(text, radix);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function evaluateBinaryExpression(
  expression: Extract<Expression, { kind: "binary" }>,
  values: ReadonlyMap<string, number>
): number | null {
  const left = evaluateExpression(expression.left, values);
  const right = evaluateExpression(expression.right, values);
  if (left === null || right === null) {
    return null;
  }

  let value: number;
  switch (expression.operator) {
    case "+":
      value = left + right;
      break;
    case "-":
      value = left - right;
      break;
    case "*":
      value = left * right;
      break;
    case "/":
      if (right === 0) return null;
      value = Math.trunc(left / right);
      break;
    case "<":
      return left < right ? 1 : 0;
    case "=":
      return left === right ? 1 : 0;
    case ">":
      return left > right ? 1 : 0;
    case "#":
      return left !== right ? 1 : 0;
    case "&":
      value = left & right;
      break;
    case ".":
      value = left | right;
      break;
    case "!":
      value = left ^ right;
      break;
  }

  return Number.isSafeInteger(value) ? value : null;
}
