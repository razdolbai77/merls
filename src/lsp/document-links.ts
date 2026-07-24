import { DocumentLink } from "vscode-languageserver/node";
import { CachedDocument } from "../asm/document";
import { type Expression } from "../asm/expression";

const includeDirectives = new Set(["asm", "put", "use"]);

type IncludeTarget = {
  path: string;
  startChar: number;
  endChar: number;
};

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

    const includeTarget = getIncludeTarget(node.operand);
    if (includeTarget === null) {
      continue;
    }

    try {
      const targetUri = new URL(includeTarget.path, uri).href;
      links.push({
        range: {
          start: { line: line.line, character: includeTarget.startChar },
          end: { line: line.line, character: includeTarget.endChar }
        },
        target: targetUri
      });
    } catch {
      // Ignore invalid URLs
    }
  }

  return links;
}

function getIncludeTarget(expression: Expression): IncludeTarget | null {
  if (expression.kind === "identifier") {
    return {
      path: expression.value,
      startChar: expression.token.start,
      endChar: expression.token.end
    };
  }

  if (expression.kind === "string") {
    return {
      path: expression.value,
      startChar: expression.token.start,
      endChar: expression.token.end
    };
  }

  if (expression.kind === "binary") {
    const left = getIncludeTarget(expression.left);
    const right = getIncludeTarget(expression.right);
    if (left !== null && right !== null) {
      return {
        path: `${left.path}${expression.operator}${right.path}`,
        startChar: left.startChar,
        endChar: right.endChar
      };
    }
  }

  return null;
}
