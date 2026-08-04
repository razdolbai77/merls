import fs from "node:fs";
import path from "node:path";

import { type CachedDocument, buildCachedDocument } from "./document";
import { type Expression } from "./expression";
import { collectWorkspaceMacros, type WorkspaceMacroDefinition } from "./macros";
import { collectSymbols } from "./symbols";

export type WorkspaceSymbol = {
  name: string;
  kind: "label" | "equate" | "variable" | "data" | "macro";
  line: number;
  filePath: string;
};

export type IndexedWorkspace = {
  documents: ReadonlyMap<string, CachedDocument>;
  dependencies: ReadonlyMap<string, readonly string[]>;
  loadOrder: readonly string[];
  symbols: ReadonlyMap<string, WorkspaceSymbol>;
  macros: ReadonlyMap<string, readonly WorkspaceMacroDefinition[]>;
};

export const includeDirectives = new Set(["asm", "put", "use"]);

export function indexWorkspace(
  entryPath: string,
  diskCache: Map<string, CachedDocument>,
  overrides?: ReadonlyMap<string, CachedDocument>
): IndexedWorkspace {
  const documents = new Map<string, CachedDocument>();
  const dependencies = new Map<string, readonly string[]>();
  const loadOrder: string[] = [];
  const symbols = new Map<string, WorkspaceSymbol>();

  const resolvedEntry = entryPath.startsWith("untitled:") 
    ? entryPath 
    : path.resolve(entryPath);
  visitFile(resolvedEntry, documents, dependencies, loadOrder, diskCache, overrides);

  for (const filePath of loadOrder) {
    const document = documents.get(filePath);
    if (document === undefined) {
      continue;
    }

    for (const symbol of collectSymbols(document.parsed).values()) {
      symbols.set(symbol.name, {
        ...symbol,
        filePath
      });
    }
  }

  const macros = collectWorkspaceMacros(documents);

  return {
    documents,
    dependencies,
    loadOrder,
    symbols,
    macros
  };
}

function lookupByPath(
  map: ReadonlyMap<string, CachedDocument>,
  filePath: string
): CachedDocument | undefined {
  const exact = map.get(filePath);
  if (exact !== undefined || process.platform !== "win32") {
    return exact;
  }

  const lowered = filePath.toLowerCase();
  for (const [key, value] of map.entries()) {
    if (key.toLowerCase() === lowered) {
      return value;
    }
  }

  return undefined;
}

function visitFile(
  filePath: string,
  documents: Map<string, CachedDocument>,
  dependencies: Map<string, readonly string[]>,
  loadOrder: string[],
  diskCache: Map<string, CachedDocument>,
  overrides?: ReadonlyMap<string, CachedDocument>
): void {
  if (lookupByPath(documents, filePath) !== undefined) {
    return;
  }

  let document: CachedDocument | undefined = overrides ? lookupByPath(overrides, filePath) : undefined;

  if (document === undefined) {
    document = lookupByPath(diskCache, filePath);
  }

  if (document === undefined) {
    let source: string;
    try {
      source = fs.readFileSync(filePath, "utf8");
    } catch {
      return;
    }
    document = buildCachedDocument(source);
    diskCache.set(filePath, document);
  }

  documents.set(filePath, document);
  loadOrder.push(filePath);

  const resolvedDependencies = document.parsed.lines
    .flatMap((line) => {
      const node = line.node;
      if (node.shape !== "directive" || !includeDirectives.has(node.directive.lexeme.toLowerCase())) {
        return [];
      }

      const includeTarget = readIncludeTarget(node.operand);
      if (includeTarget === null) {
        return [];
      }

      return [path.resolve(path.dirname(filePath), includeTarget.path)];
    });

  dependencies.set(filePath, resolvedDependencies);

  for (const dependencyPath of resolvedDependencies) {
    visitFile(dependencyPath, documents, dependencies, loadOrder, diskCache, overrides);
  }
}

export type IncludeTarget = {
  path: string;
  range: { startCharacter: number; endCharacter: number } | null;
};

export function readIncludeTarget(expression: Expression | null): IncludeTarget | null {
  if (expression === null) {
    return null;
  }

  if (expression.kind === "identifier" || expression.kind === "string") {
    return {
      path: expression.value,
      range: {
        startCharacter: expression.token.start,
        endCharacter: expression.token.end
      }
    };
  }

  if (expression.kind === "numericLiteral") {
    return { path: expression.value, range: null };
  }

  if (expression.kind === "binary") {
    const left = readIncludeTarget(expression.left);
    const right = readIncludeTarget(expression.right);
    if (left !== null && right !== null) {
      const range = left.range !== null && right.range !== null
        ? { startCharacter: left.range.startCharacter, endCharacter: right.range.endCharacter }
        : null;
      return { path: `${left.path}${expression.operator}${right.path}`, range };
    }
  }

  if (expression.kind === "unary") {
    const inner = readIncludeTarget(expression.expression);
    if (inner !== null) {
      return { path: `${expression.operator}${inner.path}`, range: null };
    }
  }

  return null;
}
