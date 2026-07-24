import { directiveTable, opcodeTable } from "./metadata";

export type TokenKind =
  | "comment"
  | "label"
  | "localLabel"
  | "directive"
  | "mnemonic"
  | "string"
  | "numericLiteral"
  | "modifier"
  | "expressionOperator"
  | "identifier";

export type Token = {
  kind: TokenKind;
  lexeme: string;
  start: number;
  end: number;
};

export type LexedLine = {
  line: number;
  text: string;
  tokens: readonly Token[];
};

export type LexedSource = {
  lines: readonly LexedLine[];
};

const operatorCharacters: Record<string, true> = {
  "(": true,
  ")": true,
  ",": true,
  "#": true,
  "+": true,
  "-": true,
  "*": true,
  "/": true,
  "=": true,
  "<": true,
  ">": true,
  "^": true,
  "&": true,
  ".": true,
  "!": true,
  "{": true,
  "}": true
};

export function lexSource(source: string): LexedSource {
  const lines = source.split(/\r?\n/).map((text, index) => lexLine(text, index));
  return { lines };
}

function lexLine(text: string, line: number): LexedLine {
  const tokens: Token[] = [];
  const firstNonWhitespace = text.search(/\S/);

  if (firstNonWhitespace === -1) {
    return { line, text, tokens };
  }

  const trimmed = text.slice(firstNonWhitespace);
  if (trimmed.startsWith(";") || (firstNonWhitespace === 0 && trimmed.startsWith("*"))) {
    tokens.push(createToken("comment", text.slice(firstNonWhitespace), firstNonWhitespace, text.length));
    return { line, text, tokens };
  }

  let index = firstNonWhitespace;
  let sawOperation = false;

  while (index < text.length) {
    const char = text[index];

    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }

    if (char === ";") {
      tokens.push(createToken("comment", text.slice(index), index, text.length));
      break;
    }

    if (char === '"' || char === "'") {
      const end = consumeString(text, index);
      tokens.push(createToken("string", text.slice(index, end), index, end));
      index = end;
      continue;
    }

    const startsRelativePath = char === "." &&
      (text[index + 1] === "." || text[index + 1] === "/" || text[index + 1] === "\\") &&
      (index === 0 || text[index - 1] === " " || text[index - 1] === "\t");
    if (operatorCharacters[char] === true && !startsRelativePath) {
      if (char === "<" && text.slice(index, index + 3) === "<<<") {
        tokens.push(createToken("directive", "<<<", index, index + 3));
        sawOperation = true;
        index += 3;
        continue;
      }

      const numericLiteral = consumeNumericLiteral(text, index);
      if (numericLiteral !== null) {
        tokens.push(createToken("numericLiteral", numericLiteral.lexeme, index, numericLiteral.end));
        index = numericLiteral.end;
        continue;
      }

      const operatorKind: TokenKind =
        char === "<" || char === ">" || char === "^"
          ? "modifier"
          : "expressionOperator";
      tokens.push(createToken(operatorKind, char, index, index + 1));
      index += 1;
      continue;
    }

    const end = consumeWord(text, index);
    const lexeme = text.slice(index, end);
    const kind = classifyWord(
      text,
      lexeme,
      index,
      end,
      tokens.length === 0,
      sawOperation,
      firstNonWhitespace
    );
    tokens.push(createToken(kind, lexeme, index, end));
    sawOperation ||= kind === "directive" || kind === "mnemonic";
    index = end;
  }

  return { line, text, tokens };
}

function createToken(kind: TokenKind, lexeme: string, start: number, end: number): Token {
  return {
    kind,
    lexeme,
    start,
    end
  };
}

function consumeString(text: string, start: number): number {
  const quote = text[start];
  let index = start + 1;

  while (index < text.length) {
    if (text[index] === quote) {
      return index + 1;
    }
    index += 1;
  }

  return text.length;
}

function consumeNumericLiteral(text: string, start: number): { lexeme: string; end: number } | null {
  const prefixed = text.slice(start).match(/^(?:\$[0-9A-Fa-f]+|%[01]+|\d+)/);
  if (prefixed !== null) {
    return {
      lexeme: prefixed[0],
      end: start + prefixed[0].length
    };
  }

  return null;
}

function consumeWord(text: string, start: number): number {
  const isRelativePath = text[start] === "." &&
    (text[start + 1] === "." || text[start + 1] === "/" || text[start + 1] === "\\");
  let index = start;

  while (index < text.length) {
    const char = text[index];
    if (
      char === " " ||
      char === "\t" ||
      char === ";" ||
      (operatorCharacters[char] === true && !(isRelativePath && char === "."))
    ) {
      break;
    }
    index += 1;
  }

  return index;
}

function classifyWord(
  text: string,
  lexeme: string,
  _start: number,
  end: number,
  isFirstToken: boolean,
  sawOperation: boolean,
  firstNonWhitespace: number
): TokenKind {
  const normalized = lexeme.toLowerCase();

  if (opcodeTable.has(normalized)) {
    return "mnemonic";
  }

  if (directiveTable.has(normalized)) {
    return "directive";
  }

  if (lexeme.startsWith("]") || lexeme.startsWith(":")) {
    return "localLabel";
  }

  if (/^(?:\$[0-9A-Fa-f]+|%[01]+|\d+)$/.test(lexeme)) {
    return "numericLiteral";
  }

  const trailingText = text.slice(end);
  const looksLikeLabelBoundary =
    trailingText.length === 0 || /^[\t ]/.test(trailingText);

  if (isFirstToken && !sawOperation && firstNonWhitespace === 0 && looksLikeLabelBoundary) {
    return "label";
  }

  return "identifier";
}

export function tokenAtCharacter(tokens: readonly Token[], character: number): Token | null {
  for (const token of tokens) {
    if (character >= token.start && character < token.end) {
      return token;
    }
  }

  return null;
}
