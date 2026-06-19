import { parseSourceLines, type ParsedLine } from "./parser";

export type DocumentLine = {
  line: number;
  node: ParsedLine;
};

export type DocumentError = {
  line: number;
  text: string;
  message: string;
};

export type ParsedDocument = {
  lines: readonly DocumentLine[];
  errors: readonly DocumentError[];
};

export function parseDocument(source: string): ParsedDocument {
  const parsedLines = parseSourceLines(source);
  const lines: DocumentLine[] = [];
  const errors: DocumentError[] = [];

  parsedLines.forEach((node, line) => {
    lines.push({
      line,
      node
    });

    if (node.shape === "malformed") {
      errors.push({
        line,
        text: node.text,
        message: node.message
      });
    }
  });

  return {
    lines,
    errors
  };
}
