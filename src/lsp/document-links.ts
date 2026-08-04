import { type DocumentLink } from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { includeDirectives, readIncludeTarget } from "../asm/workspace";

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

    const includeTarget = readIncludeTarget(node.operand);
    if (includeTarget === null || includeTarget.range === null) {
      continue;
    }

    try {
      const targetUri = new URL(includeTarget.path, uri).href;
      links.push({
        range: {
          start: { line: line.line, character: includeTarget.range.startCharacter },
          end: { line: line.line, character: includeTarget.range.endCharacter }
        },
        target: targetUri
      });
    } catch {
      // Ignore invalid URLs
    }
  }

  return links;
}

