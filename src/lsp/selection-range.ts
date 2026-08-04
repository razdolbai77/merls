import { type SelectionRange, type Position, type Range } from "vscode-languageserver/node";
import { type CachedDocument } from "../asm/document";
import { tokenAtCharacter } from "../asm/lexer";
import { type ParsedLine } from "../asm/parser";

export function buildSelectionRanges(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  positions: Position[]
): SelectionRange[] | null {
  const cached = openDocuments.get(uri);
  if (cached === undefined) {
    return null;
  }

  const lines = cached.source.split(/\r?\n/);
  const totalLines = lines.length;

  const globalLabelLines: number[] = [];
  for (const docLine of cached.parsed.lines) {
    if (isGlobalLabel(docLine.node)) {
      globalLabelLines.push(docLine.line);
    }
  }

  const results: SelectionRange[] = [];

  for (const pos of positions) {
    const fileRange: Range = {
      start: { line: 0, character: 0 },
      end: { line: totalLines - 1, character: lines[totalLines - 1].length }
    };

    if (pos.line < 0 || pos.line >= totalLines) {
      results.push({ range: fileRange });
      continue;
    }

    let parentRange: SelectionRange = { range: fileRange };

    let scopeStart = 0;
    let scopeEnd = totalLines - 1;
    for (const glLine of globalLabelLines) {
      if (glLine <= pos.line) {
        scopeStart = glLine;
      } else {
        scopeEnd = glLine - 1;
        break;
      }
    }
    
    const scopeRange: Range = {
      start: { line: scopeStart, character: 0 },
      end: { line: scopeEnd, character: lines[scopeEnd].length }
    };

    if (!rangesEqual(scopeRange, fileRange)) {
      parentRange = { range: scopeRange, parent: parentRange };
    }

    const lineRange: Range = {
      start: { line: pos.line, character: 0 },
      end: { line: pos.line, character: lines[pos.line].length }
    };

    if (!rangesEqual(lineRange, scopeRange)) {
      parentRange = { range: lineRange, parent: parentRange };
    }

    const lexedLine = cached.lexed.lines[pos.line];
    if (lexedLine !== undefined) {
      const token = tokenAtCharacter(lexedLine.tokens, pos.character);
      if (token !== undefined && token !== null) {
        const tokenRange: Range = {
          start: { line: pos.line, character: token.start },
          end: { line: pos.line, character: token.end }
        };
        if (!rangesEqual(tokenRange, lineRange)) {
          parentRange = { range: tokenRange, parent: parentRange };
        }
      }
    }

    results.push(parentRange);
  }

  return results;
}

function rangesEqual(a: Range, b: Range): boolean {
  return a.start.line === b.start.line &&
         a.start.character === b.start.character &&
         a.end.line === b.end.line &&
         a.end.character === b.end.character;
}

function isGlobalLabel(node: ParsedLine): boolean {
  let name: string | null = null;
  if (node.shape === "equate") name = node.label.lexeme;
  else if (node.shape === "labelOnly") name = node.label.lexeme;
  else if (node.shape === "instruction" && node.label !== null) name = node.label.lexeme;
  else if (node.shape === "directive" && node.label !== null) name = node.label.lexeme;
  else if (node.shape === "data" && node.label !== null) name = node.label.lexeme;

  if (name !== null) {
    return !name.startsWith("]") && !name.startsWith(":");
  }
  return false;
}
