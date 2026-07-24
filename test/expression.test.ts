import assert from "node:assert/strict";

import { lexSource } from "../src/asm/lexer";
import {
  type Expression,
  parseExpression,
  parseOperand
} from "../src/asm/expression";

function summarizeExpression(expression: Expression): unknown {
  switch (expression.kind) {
    case "binary":
      return {
        kind: expression.kind,
        operator: expression.operator,
        left: summarizeExpression(expression.left),
        right: summarizeExpression(expression.right)
      };
    case "modifier":
      return {
        kind: expression.kind,
        operator: expression.operator,
        expression: summarizeExpression(expression.expression)
      };
    case "unary":
      return {
        kind: expression.kind,
        operator: expression.operator,
        expression: summarizeExpression(expression.expression)
      };
    case "currentAddress":
      return {
        kind: expression.kind
      };
    default:
      return {
        kind: expression.kind,
        value: expression.value
      };
  }
}

function operandTokens(sourceLine: string) {
  const line = lexSource(sourceLine).lines[0];
  assert.ok(line, "expected a lexed line");
  return line.tokens.slice(1);
}

export function runExpressionTest(): void {
  const arithmeticTokens = lexSource("_tmp+dum1+1").lines[0]?.tokens ?? [];
  const arithmetic = parseExpression(arithmeticTokens);
  assert.equal(arithmetic.nextTokenIndex, arithmeticTokens.length);
  assert.deepEqual(summarizeExpression(arithmetic.expression), {
    kind: "binary",
    operator: "+",
    left: {
      kind: "binary",
      operator: "+",
      left: { kind: "identifier", value: "_tmp" },
      right: { kind: "identifier", value: "dum1" }
    },
    right: { kind: "numericLiteral", value: "1" }
  });

  const merlinArithmeticTokens = lexSource("1+2*3").lines[0]?.tokens ?? [];
  const merlinArithmetic = parseExpression(merlinArithmeticTokens);
  assert.deepEqual(summarizeExpression(merlinArithmetic.expression), {
    kind: "binary",
    operator: "*",
    left: {
      kind: "binary",
      operator: "+",
      left: { kind: "numericLiteral", value: "1" },
      right: { kind: "numericLiteral", value: "2" }
    },
    right: { kind: "numericLiteral", value: "3" }
  });

  const bracedArithmeticTokens = lexSource("{1+2*3}").lines[0]?.tokens ?? [];
  const bracedArithmetic = parseExpression(bracedArithmeticTokens);
  assert.deepEqual(summarizeExpression(bracedArithmetic.expression), {
    kind: "binary",
    operator: "+",
    left: { kind: "numericLiteral", value: "1" },
    right: {
      kind: "binary",
      operator: "*",
      left: { kind: "numericLiteral", value: "2" },
      right: { kind: "numericLiteral", value: "3" }
    }
  });

  for (const operator of ["<", "=", ">", "#", "&", ".", "!"]) {
    const tokens = lexSource(`1${operator}2`).lines[0]?.tokens ?? [];
    const parsed = parseExpression(tokens);
    assert.equal(parsed.nextTokenIndex, tokens.length);
    assert.deepEqual(summarizeExpression(parsed.expression), {
      kind: "binary",
      operator,
      left: { kind: "numericLiteral", value: "1" },
      right: { kind: "numericLiteral", value: "2" }
    });
  }

  const logicalPrecedenceTokens = lexSource("{1+2&3}").lines[0]?.tokens ?? [];
  const logicalPrecedence = parseExpression(logicalPrecedenceTokens);
  assert.deepEqual(summarizeExpression(logicalPrecedence.expression), {
    kind: "binary",
    operator: "+",
    left: { kind: "numericLiteral", value: "1" },
    right: {
      kind: "binary",
      operator: "&",
      left: { kind: "numericLiteral", value: "2" },
      right: { kind: "numericLiteral", value: "3" }
    }
  });

  const numericForms = ["$10", "%1010", "42"];
  for (const numericForm of numericForms) {
    const tokens = lexSource(numericForm).lines[0]?.tokens ?? [];
    const parsed = parseExpression(tokens);
    assert.deepEqual(summarizeExpression(parsed.expression), {
      kind: "numericLiteral",
      value: numericForm
    });
  }

  const currentAddressTokens = lexSource("dumSize = *").lines[0]?.tokens.slice(2) ?? [];
  const currentAddress = parseExpression(currentAddressTokens);
  assert.equal(currentAddress.nextTokenIndex, currentAddressTokens.length);
  assert.deepEqual(summarizeExpression(currentAddress.expression), {
    kind: "currentAddress"
  });

  const unaryTokens = lexSource("-$10 + +42").lines[0]?.tokens ?? [];
  const unaryParsed = parseExpression(unaryTokens);
  assert.deepEqual(summarizeExpression(unaryParsed.expression), {
    kind: "binary",
    operator: "+",
    left: {
      kind: "unary",
      operator: "-",
      expression: { kind: "numericLiteral", value: "$10" }
    },
    right: {
      kind: "unary",
      operator: "+",
      expression: { kind: "numericLiteral", value: "42" }
    }
  });

  const modifierTokens = lexSource("<value+1").lines[0]?.tokens ?? [];
  const modifier = parseExpression(modifierTokens);
  assert.deepEqual(summarizeExpression(modifier.expression), {
    kind: "binary",
    operator: "+",
    left: {
      kind: "modifier",
      operator: "<",
      expression: { kind: "identifier", value: "value" }
    },
    right: { kind: "numericLiteral", value: "1" }
  });

  const immediateOperand = parseOperand(operandTokens("        ldx #_LFT"));
  assert.equal(immediateOperand.operand.immediate, true);
  assert.equal(immediateOperand.operand.indirect, false);
  assert.equal(immediateOperand.operand.indexRegister, null);
  assert.deepEqual(summarizeExpression(immediateOperand.operand.expression), {
    kind: "identifier",
    value: "_LFT"
  });

  const immediateModifierOperand = parseOperand(operandTokens("        ldx #<value"));
  assert.equal(immediateModifierOperand.operand.immediate, true);
  assert.deepEqual(summarizeExpression(immediateModifierOperand.operand.expression), {
    kind: "modifier",
    operator: "<",
    expression: { kind: "identifier", value: "value" }
  });

  const indexedOperand = parseOperand(
    operandTokens("        sta TSTADDR+_num1+dum0,x")
  );
  assert.equal(indexedOperand.operand.immediate, false);
  assert.equal(indexedOperand.operand.indirect, false);
  assert.equal(indexedOperand.operand.indexRegister, "x");

  const indirectIndexedOperand = parseOperand(
    operandTokens("        adc (_tmp+dum1+1,x)")
  );
  assert.equal(indirectIndexedOperand.operand.immediate, false);
  assert.equal(indirectIndexedOperand.operand.indirect, true);
  assert.equal(indirectIndexedOperand.operand.indexRegister, "x");
  assert.deepEqual(summarizeExpression(indirectIndexedOperand.operand.expression), {
    kind: "binary",
    operator: "+",
    left: {
      kind: "binary",
      operator: "+",
      left: { kind: "identifier", value: "_tmp" },
      right: { kind: "identifier", value: "dum1" }
    },
    right: { kind: "numericLiteral", value: "1" }
  });
}
