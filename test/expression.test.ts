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

  const numericForms = ["$10", "%1010", "42"];
  for (const numericForm of numericForms) {
    const tokens = lexSource(numericForm).lines[0]?.tokens ?? [];
    const parsed = parseExpression(tokens);
    assert.deepEqual(summarizeExpression(parsed.expression), {
      kind: "numericLiteral",
      value: numericForm
    });
  }

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
