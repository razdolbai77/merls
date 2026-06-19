export type TokenKindDefinition = {
  name: string;
  description: string;
  captureExamples: readonly string[];
};

export type LineShapeDefinition = {
  name: string;
  description: string;
  allowsLabel: boolean;
  allowsExpression: boolean;
  requiresOperand: boolean;
  terminal: boolean;
};

function defineTokenKind(
  name: string,
  description: string,
  captureExamples: readonly string[]
): TokenKindDefinition {
  return {
    name,
    description,
    captureExamples
  };
}

function defineLineShape(
  name: string,
  description: string,
  allowsLabel: boolean,
  allowsExpression: boolean,
  requiresOperand: boolean,
  terminal: boolean
): LineShapeDefinition {
  return {
    name,
    description,
    allowsLabel,
    allowsExpression,
    requiresOperand,
    terminal
  };
}

export const tokenKindDefinitions: readonly TokenKindDefinition[] = [
  defineTokenKind("comment", "Line or trailing comment text.", ["; trailing note", "* monitor addresses"]),
  defineTokenKind("label", "Global symbol at the start of a line.", ["TEST_START", "GetKey"]),
  defineTokenKind("localLabel", "Merlin local label form.", ["]loop", ":good"]),
  defineTokenKind("directive", "Assembler directive or pseudo-op.", ["org", "dum", "hex"]),
  defineTokenKind("mnemonic", "6502 instruction mnemonic.", ["lda", "adc", "jmp"]),
  defineTokenKind("string", "Quoted string literal.", ["\"THE END\"", "'A'"]),
  defineTokenKind("numericLiteral", "Numeric literal in Merlin syntax.", ["$800", "#0", "%00"]),
  defineTokenKind("modifier", "Unary byte or bank selector modifier.", ["<value", ">value", "^value"]),
  defineTokenKind("expressionOperator", "Operator inside an expression.", ["+", "-", "*"]),
  defineTokenKind("identifier", "Non-label symbol reference.", ["_tmp", "dumSize", "DOSWARM"])
];

export const tokenKindTable = new Map(
  tokenKindDefinitions.map((definition) => [definition.name, definition] as const)
);

export const lineShapeDefinitions: readonly LineShapeDefinition[] = [
  defineLineShape("empty", "Whitespace-only line.", false, false, false, true),
  defineLineShape("commentOnly", "Full-line comment.", false, false, false, true),
  defineLineShape("labelOnly", "Standalone label with no operation.", true, false, false, true),
  defineLineShape("instruction", "Instruction mnemonic with optional operand.", true, true, false, true),
  defineLineShape("directive", "Directive with optional operand depending on directive kind.", true, true, false, true),
  defineLineShape("equate", "Symbol definition using an expression.", true, true, true, true),
  defineLineShape("data", "Data-emitting directive such as ASC, DB, or HEX.", true, true, true, true),
  defineLineShape("malformed", "Token sequence that does not match a known line shape.", true, true, false, true)
];

export const lineShapeTable = new Map(
  lineShapeDefinitions.map((definition) => [definition.name, definition] as const)
);
