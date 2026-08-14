import { type ParsedDocument } from "./document";
import { type Expression, type Operand, walkExpression } from "./expression";
import { type ParsedLine } from "./parser";
import { type Token } from "./lexer";

export type LocalLabelDefinition = {
  name: string;
  line: number;
  anchor: string;
  qualifiedName: string;
};

export type LocalLabelReference = {
  name: string;
  line: number;
  anchor: string;
  qualifiedName: string;
  targetLine: number;
};

export type LocalLabelScope = {
  definitions: Map<string, LocalLabelDefinition>;
  references: Map<string, LocalLabelReference>;
  anchors: Map<number, string>;
};

type AnchorState = {
  name: string;
  line: number;
};

export function resolveLocalLabels(document: ParsedDocument): LocalLabelScope {
  const definitions = new Map<string, LocalLabelDefinition>();
  const references = new Map<string, LocalLabelReference>();
  const anchors = new Map<number, string>();
  const definitionsByAnchor = new Map<string, Map<string, LocalLabelDefinition[]>>();

  const variableNames = new Set<string>();
  for (const line of document.lines) {
    if (line.node.shape === "equate" && line.node.isVariable) {
      variableNames.add(line.node.label.lexeme);
    }
  }

  let currentAnchor: AnchorState | null = null;

  for (const line of document.lines) {
    currentAnchor = updateAnchor(currentAnchor, line.node, line.line);
    if (currentAnchor !== null) {
      anchors.set(line.line, currentAnchor.name);
    }

    const localDefinition = getLocalDefinition(line.node);
    if (currentAnchor === null || localDefinition === null) {
      continue;
    }

    const qualifiedName = qualifyLocalName(localDefinition, line.line);
    const definition: LocalLabelDefinition = {
      name: localDefinition,
      line: line.line,
      anchor: currentAnchor.name,
      qualifiedName
    };

    definitions.set(qualifiedName, definition);

    let anchorDefinitions = definitionsByAnchor.get(currentAnchor.name);
    if (anchorDefinitions === undefined) {
      anchorDefinitions = new Map();
      definitionsByAnchor.set(currentAnchor.name, anchorDefinitions);
    }
    let defs = anchorDefinitions.get(localDefinition);
    if (!defs) {
      defs = [];
      anchorDefinitions.set(localDefinition, defs);
    }
    defs.push(definition);
  }

  currentAnchor = null;

  for (const line of document.lines) {
    currentAnchor = updateAnchor(currentAnchor, line.node, line.line);
    if (currentAnchor === null) {
      continue;
    }

    const anchorDefinitions = definitionsByAnchor.get(currentAnchor.name);
    if (anchorDefinitions === undefined) {
      continue;
    }

    for (const localName of findLocalReferences(line.node)) {
      if (variableNames.has(localName)) {
        continue;
      }

      const targets = anchorDefinitions.get(localName);
      if (targets === undefined) {
        continue;
      }

      let target: LocalLabelDefinition | undefined;
      if (localName.startsWith("]")) {
        target = targets.slice().reverse().find(d => d.line < line.line);
      } else {
        // For ':', search backward first, then forward
        target = targets.slice().reverse().find(d => d.line < line.line) 
              ?? targets.find(d => d.line > line.line);
      }

      if (target === undefined) {
        continue;
      }

      references.set(qualifyLocalName(localName, line.line), {
        name: localName,
        line: line.line,
        anchor: currentAnchor.name,
        qualifiedName: target.qualifiedName,
        targetLine: target.line
      });
    }
  }

  return {
    definitions,
    references,
    anchors
  };
}

function updateAnchor(
  currentAnchor: AnchorState | null,
  node: ParsedLine,
  line: number
): AnchorState | null {
  const label = getGlobalLabel(node);
  if (label === null) {
    return currentAnchor;
  }

  return {
    name: label,
    line
  };
}

function getGlobalLabel(node: ParsedLine): string | null {
  return getGlobalLabelToken(node)?.lexeme ?? null;
}

export function getGlobalLabelToken(node: ParsedLine): Token | null {
  if ("label" in node && node.label !== null && isGlobalLabel(node.label.lexeme)) {
    return node.label;
  }
  return null;
}

export function getLocalLabelToken(node: ParsedLine): Token | null {
  if (node.shape === "equate" && node.isVariable) {
    return null;
  }
  if ("label" in node && node.label !== null && isLocalLabel(node.label.lexeme)) {
    return node.label;
  }
  return null;
}

function getLocalDefinition(node: ParsedLine): string | null {
  return getLocalLabelToken(node)?.lexeme ?? null;
}

function findLocalReferences(node: ParsedLine): readonly string[] {
  if (node.shape === "instruction" && node.operand !== null) {
    return findLocalNamesInOperand(node.operand);
  }

  if (node.shape === "directive" && node.operand !== null) {
    return findLocalNamesInExpression(node.operand);
  }

  if (node.shape === "equate") {
    return findLocalNamesInExpression(node.expression);
  }

  return [];
}

function findLocalNamesInOperand(operand: Operand): readonly string[] {
  return findLocalNamesInExpression(operand.expression);
}

function findLocalNamesInExpression(expression: Expression): readonly string[] {
  const names: string[] = [];
  walkExpression(expression, (identifier) => {
    if (isLocalLabel(identifier.value)) {
      names.push(identifier.value);
    }
  });
  return names;
}

function isGlobalLabel(name: string): boolean {
  return !isLocalLabel(name) && !name.startsWith("@");
}

export function isLocalLabel(name: string): boolean {
  return name.startsWith("]") || name.startsWith(":");
}

export function qualifyLocalName(name: string, line: number): string {
  return `${name}@${line}`;
}

export function getLocalLabelReference(
  scope: LocalLabelScope,
  name: string,
  line: number
): LocalLabelReference | undefined {
  return scope.references.get(qualifyLocalName(name, line));
}

export function getLocalLabelDefinition(
  scope: LocalLabelScope,
  name: string,
  line: number
): LocalLabelDefinition | undefined {
  return scope.definitions.get(qualifyLocalName(name, line));
}

export function getLocalLabelTargetLine(
  scope: LocalLabelScope,
  name: string,
  line: number
): number | undefined {
  const key = qualifyLocalName(name, line);
  return scope.references.get(key)?.targetLine ?? scope.definitions.get(key)?.line;
}

export function isLocalLabelResolved(
  scope: LocalLabelScope,
  name: string,
  line: number
): boolean {
  const key = qualifyLocalName(name, line);
  return scope.definitions.has(key) || scope.references.has(key);
}
