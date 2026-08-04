import { TextEdit, FormattingOptions, type Range, type Position } from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { isAccumulatorOperand } from "../asm/expression";
import { type Token } from "../asm/lexer";
import { type ParsedLine } from "../asm/parser";
export const formattingLabelColumn = 8;
export const formattingOperationColumn = 16;
export const formattingOperandColumn = 24;


export function formatDocument(
  cached: CachedDocument,
  options: FormattingOptions
): TextEdit[] {
  return formatLines(cached, options, 0, cached.parsed.lines.length - 1);
}

export function formatRange(
  cached: CachedDocument,
  options: FormattingOptions,
  range: Range
): TextEdit[] {
  const endLine = range.end.character === 0 && range.end.line > range.start.line
    ? range.end.line - 1
    : range.end.line;
  return formatLines(cached, options, range.start.line, endLine);
}

export function formatOnType(
  cached: CachedDocument,
  options: FormattingOptions,
  position: Position,
  ch: string
): TextEdit[] {
  if (ch === "\n" && position.line > 0) {
    return formatLines(cached, options, position.line - 1, position.line - 1);
  }
  return [];
}

function formatLines(
  cached: CachedDocument,
  options: FormattingOptions,
  startLine: number,
  endLine: number
): TextEdit[] {
  const edits: TextEdit[] = [];

  for (let lineIndex = startLine; lineIndex <= endLine; lineIndex++) {
    const line = cached.parsed.lines[lineIndex];
    if (line === undefined || line.node.shape === "malformed") {
      continue;
    }

    const lexedLine = cached.lexed.lines[lineIndex];
    if (!lexedLine) {
      continue;
    }

    const newText = formatLine(
      line.node,
      lexedLine.tokens,
      lexedLine.text,
      options
    );

    if (newText !== null && newText !== lexedLine.text) {
      edits.push(
        TextEdit.replace(
          {
            start: { line: lineIndex, character: 0 },
            end: { line: lineIndex, character: lexedLine.text.length },
          },
          newText
        )
      );
    }
  }

  return edits;
}

function formatLine(
  node: ParsedLine,
  tokens: readonly Token[],
  originalText: string,
  options: FormattingOptions
): string | null {
  if (node.shape === "empty") return "";
  if (node.shape === "commentOnly" && tokens.length > 0) {
    // Preserve full-line comment text except trailing whitespace.
    return originalText.trimEnd();
  }
  if (node.shape === "labelOnly") return formatLabelOnly(tokens, options);

  if (
    node.shape === "equate" ||
    node.shape === "instruction" ||
    node.shape === "directive" ||
    node.shape === "data" ||
    node.shape === "macroCall"
  ) {
    return formatStructuredLine(node, tokens, options);
  }
  return null;
}

function formatLabelOnly(tokens: readonly Token[], options: FormattingOptions): string {
  const comment = getCommentToken(tokens);
  let result = tokens[0]?.lexeme ?? "";
  if (comment !== null) {
    result = padTo(result, formattingOperandColumn, options.insertSpaces, options.tabSize) + comment.lexeme;
  }
  return result.trimEnd();
}

function formatStructuredLine(
  node: ParsedLine,
  tokens: readonly Token[],
  options: FormattingOptions
): string | null {
  const fields = getLineFields(tokens);
  if (fields === null) return null;

  const operation = fields.operation.kind === "mnemonic" || fields.operation.kind === "directive"
    ? fields.operation.lexeme.toUpperCase()
    : fields.operation.lexeme;
  let result = padTo(fields.label, formattingLabelColumn, options.insertSpaces, options.tabSize) + operation;
  const comment = getCommentToken(tokens);
  const operandText = formatOperandText(node, tokens, fields.operandStart, comment);

  if (operandText.length > 0) {
    result = padTo(result, formattingOperationColumn, options.insertSpaces, options.tabSize) + operandText;
  }
  if (comment !== null) {
    result = padTo(result, formattingOperandColumn, options.insertSpaces, options.tabSize) + comment.lexeme;
  }
  return result.trimEnd();
}

function getLineFields(tokens: readonly Token[]): { label: string; operation: Token; operandStart: number } | null {
  let index = 0;
  let label = "";
  if (tokens[index]?.kind === "label" || tokens[index]?.kind === "localLabel") {
    label = tokens[index]?.lexeme ?? "";
    index++;
  }

  const operation = tokens[index];
  if (operation === undefined) return null;
  return { label, operation, operandStart: index + 1 };
}

function formatOperandText(
  node: ParsedLine,
  tokens: readonly Token[],
  operandStart: number,
  comment: Token | null
): string {
  const endTokenIndex = comment === null ? tokens.length - 1 : tokens.length - 2;
  let operandText = "";
  for (let index = operandStart; index <= endTokenIndex; index++) {
    operandText += formatOperandToken(node, tokens, index);
  }
  return operandText;
}

function formatOperandToken(node: ParsedLine, tokens: readonly Token[], index: number): string {
  const token = tokens[index];
  if (token === undefined || node.shape !== "instruction") return token?.lexeme ?? "";

  const lower = token.lexeme.toLowerCase();
  if ((lower === "x" || lower === "y") && tokens[index - 1]?.lexeme === ",") {
    return token.lexeme.toUpperCase();
  }
  if (lower === "a" && isAccumulatorOperand(node.mnemonic.lexeme, node.operand, token)) {
    return token.lexeme.toUpperCase();
  }
  return token.lexeme;
}

function getCommentToken(tokens: readonly Token[]): Token | null {
  const last = tokens[tokens.length - 1];
  return last?.kind === "comment" ? last : null;
}

function getVisualColumn(text: string, tabSize: number): number {
  let col = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\t") {
      col += tabSize - (col % tabSize);
    } else {
      col++;
    }
  }
  return col;
}

function padTo(currentText: string, targetCol: number, insertSpaces: boolean, tabSize: number): string {
  const currentVisualCol = getVisualColumn(currentText, tabSize);

  if (!insertSpaces) {
    if (currentVisualCol >= targetCol) {
      return currentText + "\t";
    }
    
    let tabsToInsert = 0;
    let col = currentVisualCol;
    while (col < targetCol) {
      tabsToInsert++;
      col += tabSize - (col % tabSize);
    }
    
    return currentText + "\t".repeat(tabsToInsert);
  }

  if (currentVisualCol >= targetCol) {
    return currentText + " ";
  }
  return currentText + " ".repeat(targetCol - currentVisualCol);
}
