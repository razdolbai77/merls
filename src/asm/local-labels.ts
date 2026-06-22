import { type ParsedDocument } from "./document";
import { type Expression, type Operand } from "./expression";
import { type ParsedLine } from "./parser";

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
};

type AnchorState = {
  name: string;
  line: number;
};

export function resolveLocalLabels(document: ParsedDocument): LocalLabelScope {
  const definitions = new Map<string, LocalLabelDefinition>();
  const references = new Map<string, LocalLabelReference>();
  const definitionsByAnchor = new Map<string, Map<string, LocalLabelDefinition>>();

  let currentAnchor: AnchorState | null = null;

  for (const line of document.lines) {
    currentAnchor = updateAnchor(currentAnchor, line.node, line.line);

    const localDefinition = getLocalDefinition(line.node);
    if (currentAnchor === null || localDefinition === null) {
      continue;
    }

    const qualifiedName = qualifyName(localDefinition, currentAnchor.line);
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
    anchorDefinitions.set(localDefinition, definition);
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
      const target = anchorDefinitions.get(localName);
      if (target === undefined) {
        continue;
      }

      references.set(qualifyName(localName, line.line), {
        name: localName,
        line: line.line,
        anchor: currentAnchor.name,
        qualifiedName: target.qualifiedName,
        targetLine: target.line
      });
    }
  }

  synthesizeMacroLocalLabels(document, definitions, references);

  return {
    definitions,
    references
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
  if (node.shape === "equate" && !isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  if (node.shape === "labelOnly" && !isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  if (node.shape === "instruction" && node.label !== null && !isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  if (node.shape === "directive" && node.label !== null && !isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  if (node.shape === "data" && node.label !== null && !isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  return null;
}


function getLocalDefinition(node: ParsedLine): string | null {
  if (node.shape === "labelOnly" && isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  if (node.shape === "instruction" && node.label !== null && isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  if (node.shape === "directive" && node.label !== null && isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  if (node.shape === "data" && node.label !== null && isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  if (node.shape === "equate" && isLocalLabel(node.label.lexeme)) {
    return node.label.lexeme;
  }

  return null;
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
  switch (expression.kind) {
    case "identifier":
      return isLocalLabel(expression.value) ? [expression.value] : [];
    case "modifier":
      return findLocalNamesInExpression(expression.expression);
    case "binary":
      return [
        ...findLocalNamesInExpression(expression.left),
        ...findLocalNamesInExpression(expression.right)
      ];
    default:
      return [];
  }
}

function isLocalLabel(name: string): boolean {
  return name.startsWith("]") || name.startsWith(":");
}

function qualifyName(name: string, line: number): string {
  return `${name}@${line}`;
}

function synthesizeMacroLocalLabels(
  document: ParsedDocument,
  definitions: Map<string, LocalLabelDefinition>,
  references: Map<string, LocalLabelReference>
): void {
  let currentAnchor: AnchorState | null = null;

  for (const line of document.lines) {
    currentAnchor = updateAnchor(currentAnchor, line.node, line.line);
    if (line.node.shape !== "macroCall" || currentAnchor === null) {
      continue;
    }

    const macroCallNode = line.node;

    const macroDefinition = document.macroDefinitions.find((definition) => definition.name === macroCallNode.macro.lexeme);
    if (macroDefinition === undefined) {
      continue;
    }

    const expansionDefinitions = new Map<string, LocalLabelDefinition>();
    for (const bodyLine of macroDefinition.body) {
      const localDefinition = getLocalDefinition(bodyLine.node);
      if (localDefinition === null) {
        continue;
      }

      const qualifiedName = qualifyName(localDefinition, line.line);
      const definition: LocalLabelDefinition = {
        name: localDefinition,
        line: bodyLine.line,
        anchor: currentAnchor.name,
        qualifiedName
      };
      definitions.set(qualifiedName, definition);
      expansionDefinitions.set(localDefinition, definition);
    }

    for (const bodyLine of macroDefinition.body) {
      for (const localName of findLocalReferences(bodyLine.node)) {
        const target = expansionDefinitions.get(localName);
        if (target === undefined) {
          continue;
        }

        references.set(`${qualifyName(localName, line.line)}:${bodyLine.line}`, {
          name: localName,
          line: bodyLine.line,
          anchor: currentAnchor.name,
          qualifiedName: target.qualifiedName,
          targetLine: target.line
        });
      }
    }

    for (let nextLineIndex = line.line + 1; nextLineIndex < document.lines.length; nextLineIndex += 1) {
      const nextLine = document.lines[nextLineIndex];
      if (nextLine === undefined) {
        continue;
      }

      const nextGlobalLabel = getGlobalLabel(nextLine.node);
      if (nextGlobalLabel !== null) {
        break;
      }

      for (const localName of findLocalReferences(nextLine.node)) {
        const target = expansionDefinitions.get(localName);
        if (target === undefined) {
          continue;
        }

        references.set(qualifyName(localName, nextLine.line), {
          name: localName,
          line: nextLine.line,
          anchor: currentAnchor.name,
          qualifiedName: target.qualifiedName,
          targetLine: target.line
        });
      }
    }
  }
}
