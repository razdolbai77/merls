import { TextEdit, FormattingOptions, Range, Position } from "vscode-languageserver/node";
import { CachedDocument } from "../asm/document";
import { Token } from "../asm/lexer";

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
      line.node.shape,
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
  shape: string,
  tokens: readonly Token[],
  originalText: string,
  options: FormattingOptions
): string | null {
  const { insertSpaces, tabSize } = options;
  const col1 = 8;
  const col2 = 16;
  const col3 = 24;

  if (shape === "empty") {
    return "";
  }
  if (shape === "commentOnly" && tokens.length > 0) {
    // Optionally format full-line comments?
    // Often full line comments start with ; or * at column 0.
    // Let's just preserve them as is for now.
    return originalText.trimEnd();
  }
  if (shape === "labelOnly") {
    const comment = getCommentToken(tokens);
    let result = tokens[0]?.lexeme ?? "";
    if (comment) {
      result = padTo(result, col3, insertSpaces, tabSize) + comment.lexeme;
    }
    return result.trimEnd();
  }

  if (
    shape === "equate" ||
    shape === "instruction" ||
    shape === "directive" ||
    shape === "data" ||
    shape === "macroCall"
  ) {
    let index = 0;
    let label = "";

    if (tokens[index]?.kind === "label" || tokens[index]?.kind === "localLabel") {
      label = tokens[index].lexeme;
      index += 1;
    }

    const operationToken = tokens[index];
    if (!operationToken) {
      return null;
    }
    const operation =
      operationToken.kind === "mnemonic" || operationToken.kind === "directive"
        ? operationToken.lexeme.toUpperCase()
        : operationToken.lexeme;
    index += 1;

    let result = label;
    result = padTo(result, col1, insertSpaces, tabSize);
    result += operation;

    // Find operands and comment
    const commentToken = getCommentToken(tokens);
    const endTokenIndex = commentToken ? tokens.length - 2 : tokens.length - 1;

    let operandText = "";
    if (index <= endTokenIndex) {
      for (let i = index; i <= endTokenIndex; i++) {
        operandText += tokens[i].lexeme;
      }
    }

    if (operandText.length > 0) {
      result = padTo(result, col2, insertSpaces, tabSize);
      result += operandText;
    }

    if (commentToken) {
      // align comment
      result = padTo(result, col3, insertSpaces, tabSize);
      result += commentToken.lexeme;
    }

    return result.trimEnd(); // Remove any trailing spaces if no comment
  }

  return null;
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
