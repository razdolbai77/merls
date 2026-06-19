import { type Location } from "vscode-languageserver/node";

import { parseDocument } from "../asm/document";
import { type Expression, type Operand } from "../asm/expression";
import { type ParsedLine } from "../asm/parser";

type SymbolDefinition = {
  name: string;
  location: Location;
};

type SymbolReference = {
  name: string;
  location: Location;
};

export function findDefinition(
  openDocuments: ReadonlyMap<string, string>,
  uri: string,
  line: number
): Location | null {
  const targetName = getSymbolAtLine(openDocuments.get(uri), line);
  if (targetName === null) {
    return null;
  }

  for (const [documentUri, source] of openDocuments.entries()) {
    for (const definition of collectDefinitions(documentUri, source)) {
      if (definition.name === targetName) {
        return definition.location;
      }
    }
  }

  return null;
}

export function findReferences(
  openDocuments: ReadonlyMap<string, string>,
  uri: string,
  line: number,
  includeDeclaration: boolean
): Location[] {
  const targetName = getSymbolAtLine(openDocuments.get(uri), line);
  if (targetName === null) {
    return [];
  }

  const locations: Location[] = [];

  for (const [documentUri, source] of openDocuments.entries()) {
    if (includeDeclaration) {
      for (const definition of collectDefinitions(documentUri, source)) {
        if (definition.name === targetName) {
          locations.push(definition.location);
        }
      }
    }

    for (const reference of collectReferences(documentUri, source)) {
      if (reference.name === targetName) {
        locations.push(reference.location);
      }
    }
  }

  return locations;
}

function getSymbolAtLine(source: string | undefined, line: number): string | null {
  if (source === undefined) {
    return null;
  }

  const node = parseDocument(source).lines[line]?.node;
  if (node === undefined) {
    return null;
  }

  if (node.shape === "labelOnly") {
    return node.label;
  }

  if (node.shape === "instruction") {
    if (node.label !== null) {
      return node.label;
    }

    return readOperandIdentifier(node.operand);
  }

  if (node.shape === "directive") {
    if (node.label !== null) {
      return node.label;
    }

    return readExpressionIdentifier(node.operand);
  }

  if (node.shape === "equate") {
    return node.label;
  }

  if (node.shape === "data" && node.label !== null) {
    return node.label;
  }

  return null;
}

function collectDefinitions(uri: string, source: string): readonly SymbolDefinition[] {
  const document = parseDocument(source);
  const definitions: SymbolDefinition[] = [];

  for (const line of document.lines) {
    const name = getDefinedName(line.node);
    if (name === null) {
      continue;
    }

    definitions.push({
      name,
      location: createLocation(uri, line.line, name)
    });
  }

  return definitions;
}

function collectReferences(uri: string, source: string): readonly SymbolReference[] {
  const document = parseDocument(source);
  const references: SymbolReference[] = [];

  for (const line of document.lines) {
    for (const name of getReferencedNames(line.node)) {
      references.push({
        name,
        location: createLocation(uri, line.line, name)
      });
    }
  }

  return references;
}

function getDefinedName(node: ParsedLine): string | null {
  if (node.shape === "equate") {
    return node.label;
  }

  if (node.shape === "labelOnly") {
    return node.label;
  }

  if (node.shape === "instruction" && node.label !== null) {
    return node.label;
  }

  if (node.shape === "directive" && node.label !== null) {
    return node.label;
  }

  if (node.shape === "data" && node.label !== null) {
    return node.label;
  }

  return null;
}

function getReferencedNames(node: ParsedLine): readonly string[] {
  if (node.shape === "instruction" && node.operand !== null) {
    return collectExpressionIdentifiers(node.operand.expression);
  }

  if (node.shape === "directive" && node.operand !== null) {
    return collectExpressionIdentifiers(node.operand);
  }

  if (node.shape === "equate") {
    return collectExpressionIdentifiers(node.expression);
  }

  return [];
}

function readOperandIdentifier(operand: Operand | null): string | null {
  if (operand === null) {
    return null;
  }

  return readExpressionIdentifier(operand.expression);
}

function readExpressionIdentifier(expression: Expression | null): string | null {
  if (expression === null) {
    return null;
  }

  if (expression.kind === "identifier") {
    return expression.value;
  }

  if (expression.kind === "modifier") {
    return readExpressionIdentifier(expression.expression);
  }

  if (expression.kind === "binary") {
    return readExpressionIdentifier(expression.left);
  }

  return null;
}

function collectExpressionIdentifiers(expression: Expression): readonly string[] {
  switch (expression.kind) {
    case "identifier":
      return [expression.value];
    case "modifier":
      return collectExpressionIdentifiers(expression.expression);
    case "binary":
      return [
        ...collectExpressionIdentifiers(expression.left),
        ...collectExpressionIdentifiers(expression.right)
      ];
    default:
      return [];
  }
}

function createLocation(uri: string, line: number, name: string): Location {
  return {
    uri,
    range: {
      start: {
        line,
        character: 0
      },
      end: {
        line,
        character: name.length
      }
    }
  };
}
