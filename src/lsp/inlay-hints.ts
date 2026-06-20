import { InlayHint, InlayHintKind } from "vscode-languageserver/node";
import { CachedDocument } from "../asm/document";
import { collectReferences } from "./symbol-navigation";

export function buildInlayHints(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string
): InlayHint[] {
  const cached = openDocuments.get(uri);
  if (cached === undefined) {
    return [];
  }

  const hints: InlayHint[] = [];
  const equates = new Map<string, string>();

  for (const doc of openDocuments.values()) {
    for (const line of doc.parsed.lines) {
      if (line.node.shape === "equate") {
        const lexedLine = doc.lexed.lines[line.line];
        const equTokenIndex = lexedLine.tokens.findIndex(
          (t) =>
            (t.kind === "directive" && t.lexeme.toLowerCase() === "equ") ||
            (t.kind === "expressionOperator" && t.lexeme === "=")
        );

        if (equTokenIndex !== -1 && equTokenIndex + 1 < lexedLine.tokens.length) {
          const start = lexedLine.tokens[equTokenIndex + 1].start;
          const end = lexedLine.tokens[lexedLine.tokens.length - 1].end;
          equates.set(line.node.label.lexeme, line.node.text.slice(start, end).trim());
        }
      }
    }
  }

  const references = collectReferences(uri, cached);
  for (const ref of references) {
    const value = equates.get(ref.name);
    if (value !== undefined) {
      hints.push({
        position: ref.location.range.end,
        label: `: ${value}`,
        kind: InlayHintKind.Type,
        paddingLeft: true
      });
    }
  }

  return hints;
}
