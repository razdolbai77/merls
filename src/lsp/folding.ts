import { FoldingRange, FoldingRangeKind } from "vscode-languageserver/node";
import { CachedDocument } from "../asm/document";

export function buildFoldingRanges(cached: CachedDocument): FoldingRange[] {
  const ranges: FoldingRange[] = [];
  
  let currentMacroStartLine: number | null = null;
  
  let currentCommentStartLine: number | null = null;
  let currentCommentEndLine: number | null = null;
  
  let currentDataStartLine: number | null = null;
  let currentDataEndLine: number | null = null;

  function flushComment() {
    if (currentCommentStartLine !== null && currentCommentEndLine !== null && currentCommentEndLine > currentCommentStartLine) {
      ranges.push({
        startLine: currentCommentStartLine,
        endLine: currentCommentEndLine,
        kind: FoldingRangeKind.Comment
      });
    }
    currentCommentStartLine = null;
    currentCommentEndLine = null;
  }

  function flushData() {
    if (currentDataStartLine !== null && currentDataEndLine !== null && currentDataEndLine > currentDataStartLine) {
      ranges.push({
        startLine: currentDataStartLine,
        endLine: currentDataEndLine,
        kind: FoldingRangeKind.Region
      });
    }
    currentDataStartLine = null;
    currentDataEndLine = null;
  }

  for (const line of cached.parsed.lines) {
    const node = line.node;
    const lineNumber = line.line;

    if (node.shape === "commentOnly") {
      if (currentCommentStartLine === null) {
        currentCommentStartLine = lineNumber;
      }
      currentCommentEndLine = lineNumber;
    } else {
      flushComment();
    }

    if (node.shape === "data") {
      if (currentDataStartLine === null) {
        currentDataStartLine = lineNumber;
      }
      currentDataEndLine = lineNumber;
    } else {
      flushData();
    }

    if (node.shape === "directive") {
      const directiveName = node.directive.lexeme.toLowerCase();
      if (directiveName === "mac") {
        currentMacroStartLine = lineNumber;
      } else if (directiveName === "eom" || directiveName === "<<<") {
        if (currentMacroStartLine !== null && lineNumber > currentMacroStartLine) {
          ranges.push({
            startLine: currentMacroStartLine,
            endLine: lineNumber,
            kind: FoldingRangeKind.Region
          });
          currentMacroStartLine = null;
        }
      }
    }
  }

  flushComment();
  flushData();

  return ranges;
}
