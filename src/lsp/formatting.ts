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
  return formatLines(cached, options, range.start.line, range.end.line);
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
  const { insertSpaces } = options;

  const col1 = 8;
  const col2 = 16;
  const col3 = 24;

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
      insertSpaces,
      col1,
      col2,
      col3
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
  insertSpaces: boolean,
  col1: number,
  col2: number,
  col3: number
): string | null {
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
      result = padTo(result, col3, insertSpaces) + comment.lexeme;
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
    result = padTo(result, col1, insertSpaces);
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
      result = padTo(result, col2, insertSpaces);
      result += operandText;
    }

    if (commentToken) {
      // align comment
      result = padTo(result, col3, insertSpaces);
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

function padTo(currentText: string, targetCol: number, insertSpaces: boolean): string {
  if (!insertSpaces) {
    // A simple tab-based padding strategy.
    // Assuming each tab advances to the next multiple of targetCol / col_units?
    // If we want to reach col1 (8), and the currentText length is 4, we need 1 tab.
    // If the length is 8, we need 1 tab to reach 16.
    // Let's just use a simple heuristic for tabs:
    // If targetCol > currentText.length, we insert enough tabs.
    // But the requirements are mostly around spaces. Let's assume standard spaces first.
    if (targetCol > currentText.length) {
      // targetCol is in spaces, e.g. 8, 16, 24
      // how many tabs to reach targetCol?
      // For simplicity, just append \t.
      return currentText + "\t";
    }
    return currentText + "\t";
  }

  if (currentText.length >= targetCol) {
    return currentText + " ";
  }
  return currentText + " ".repeat(targetCol - currentText.length);
}
