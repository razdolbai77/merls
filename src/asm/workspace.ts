import fs from "node:fs";
import path from "node:path";

import { parseDocument, type ParsedDocument } from "./document";
import { type Expression } from "./expression";
import { collectSymbols } from "./symbols";

export type WorkspaceSymbol = {
  name: string;
  kind: "label" | "equate" | "data" | "macro";
  line: number;
  filePath: string;
};

export type IndexedWorkspace = {
  documents: Map<string, ParsedDocument>;
  dependencies: Map<string, readonly string[]>;
  loadOrder: readonly string[];
  symbols: Map<string, WorkspaceSymbol>;
};

const includeDirectives = new Set(["asm", "put", "use"]);

export function indexWorkspace(entryPath: string): IndexedWorkspace {
  const documents = new Map<string, ParsedDocument>();
  const dependencies = new Map<string, readonly string[]>();
  const loadOrder: string[] = [];
  const symbols = new Map<string, WorkspaceSymbol>();

  visitFile(path.resolve(entryPath), documents, dependencies, loadOrder);

  for (const filePath of loadOrder) {
    const document = documents.get(filePath);
    if (document === undefined) {
      continue;
    }

    for (const symbol of collectSymbols(document).values()) {
      symbols.set(symbol.name, {
        ...symbol,
        filePath
      });
    }
  }

  return {
    documents,
    dependencies,
    loadOrder,
    symbols
  };
}

function visitFile(
  filePath: string,
  documents: Map<string, ParsedDocument>,
  dependencies: Map<string, readonly string[]>,
  loadOrder: string[]
): void {
  if (documents.has(filePath)) {
    return;
  }

  let source: string;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  const document = parseDocument(source);
  documents.set(filePath, document);
  loadOrder.push(filePath);

  const resolvedDependencies = document.lines
    .flatMap((line) => {
      const node = line.node;
      if (node.shape !== "directive" || !includeDirectives.has(node.directive.lexeme)) {
        return [];
      }

      const includePath = readIncludePath(node.operand);
      if (includePath === null) {
        return [];
      }

      return [path.resolve(path.dirname(filePath), includePath)];
    });

  dependencies.set(filePath, resolvedDependencies);

  for (const dependencyPath of resolvedDependencies) {
    visitFile(dependencyPath, documents, dependencies, loadOrder);
  }
}

function readIncludePath(expression: Expression | null): string | null {
  if (expression === null) {
    return null;
  }

  if (expression.kind === "identifier") {
    return expression.value;
  }

  if (expression.kind === "string") {
    return expression.value;
  }

  return null;
}
