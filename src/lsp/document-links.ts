import { DocumentLink } from "vscode-languageserver/node";
import { CachedDocument } from "../asm/document";

const includeDirectives = new Set(["asm", "put", "use"]);

export function buildDocumentLinks(uri: string, cached: CachedDocument): DocumentLink[] {
  const links: DocumentLink[] = [];

  for (const line of cached.parsed.lines) {
    const node = line.node;
    if (node.shape !== "directive" || !includeDirectives.has(node.directive.lexeme.toLowerCase())) {
      continue;
    }

    if (node.operand === null) {
      continue;
    }

    let targetPath: string | null = null;
    let startChar = 0;
    let endChar = 0;

    if (node.operand.kind === "identifier") {
      targetPath = node.operand.value;
      startChar = node.operand.token.start;
      endChar = node.operand.token.end;
    } else if (node.operand.kind === "string") {
      targetPath = node.operand.value;
      startChar = node.operand.token.start;
      endChar = node.operand.token.end;
    }

    if (targetPath !== null) {
      try {
        const targetUri = new URL(targetPath, uri).href;
        links.push({
          range: {
            start: { line: line.line, character: startChar },
            end: { line: line.line, character: endChar }
          },
          target: targetUri
        });
      } catch {
        // Ignore invalid URLs
      }
    }
  }

  return links;
}
