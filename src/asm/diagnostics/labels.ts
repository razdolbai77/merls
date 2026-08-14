import { directiveTable } from "../metadata";
import { type ParsedDocument } from "../document";
import { type Expression, type Operand, walkExpression } from "../expression";
import { type Token } from "../lexer";
import { resolveLocalLabels, isLocalLabel, getGlobalLabelToken, getLocalLabelReference } from "../local-labels";
import { type MacroDefinitionRegion, type ParsedLine } from "../parser";
import { getEffectiveLines } from "../expansion";
import {
  type Diagnostic,
  type EquateRecord,
  type MacroRecord,
  type SymbolRecord,
  resolveDiagnosticRange
} from "./types";

export function isDefinedBeforeUse(
  definition: { documentIndex: number; line: number },
  documentIndex: number,
  line: number
): boolean {
  return (
    definition.documentIndex < documentIndex ||
    (definition.documentIndex === documentIndex && definition.line <= line)
  );
}

export function collectDuplicateSymbolDiagnostics(
  symbolRecords: readonly SymbolRecord[]
): readonly Diagnostic[] {
  const firstDefinitionByName = new Map<string, SymbolRecord>();
  const diagnostics: Diagnostic[] = [];

  for (const symbol of symbolRecords) {
    const firstDefinition = firstDefinitionByName.get(symbol.name);
    if (firstDefinition === undefined) {
      firstDefinitionByName.set(symbol.name, symbol);
      continue;
    }

    diagnostics.push({
      filePath: symbol.filePath,
      line: symbol.line,
      code: "duplicate-symbol",
      message: `Duplicate symbol ${symbol.name}; first defined at line ${firstDefinition.line + 1}`,
      startCharacter: symbol.startCharacter,
      endCharacter: symbol.endCharacter
    });
  }

  return diagnostics;
}

export function collectDuplicateMacroDiagnostics(
  macrosByName: ReadonlyMap<string, readonly MacroRecord[]>
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [name, definitions] of macrosByName.entries()) {
    const firstDefinition = definitions[0];
    if (firstDefinition === undefined) {
      continue;
    }

    for (const duplicate of definitions.slice(1)) {
      diagnostics.push({
        filePath: duplicate.filePath,
        line: duplicate.line,
        code: "duplicate-macro-definition",
        message: `Duplicate macro definition ${name}; first defined at line ${firstDefinition.line + 1}`,
        startCharacter: duplicate.startCharacter,
        endCharacter: duplicate.endCharacter
      });
    }
  }

  return diagnostics;
}

export function collectUnresolvedDiagnostics(
  filePath: string,
  document: ParsedDocument,
  globalSymbols: ReadonlySet<string>,
  macroDefinitions: readonly MacroDefinitionRegion[],
  equatesByName: ReadonlyMap<string, readonly EquateRecord[]>,
  documentIndex: number,
  activeLines: ReadonlySet<number>
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const localScope = resolveLocalLabels(document);
  const variableDefinitionLines = new Map<string, number>();
  for (const line of document.lines) {
    if (!activeLines.has(line.line)) {
      continue;
    }
    if (line.node.shape === "equate" && line.node.isVariable && !variableDefinitionLines.has(line.node.label.lexeme)) {
      variableDefinitionLines.set(line.node.label.lexeme, line.line);
    }
  }

  const macroParameterLines = new Map<number, Set<string>>();

  for (const macroDefinition of document.macroDefinitions) {
    for (const bodyLine of macroDefinition.body) {
      const lineParameters = macroParameterLines.get(bodyLine.line) ?? new Set<string>();
      for (const parameterReference of bodyLine.parameterReferences) {
        lineParameters.add(parameterReference.token.lexeme);
      }
      macroParameterLines.set(bodyLine.line, lineParameters);
    }
  }

  const effectiveLines = getEffectiveLines(document, macroDefinitions);

  for (const line of effectiveLines) {
    if (!activeLines.has(line.line)) {
      continue;
    }
    const lineLength = document.lines[line.line]?.node.text.length ?? 0;

    for (const reference of findExpressionReferences(line.node)) {
      if (!line.isExpanded && macroParameterLines.get(line.line)?.has(reference.lexeme) === true) {
        continue;
      }

      if (!line.isExpanded && reference.lexeme.startsWith("@")) {
        const generatedRange = resolveDiagnosticRange(line.isExpanded, reference, lineLength);
        if (generatedRange !== null) {
          diagnostics.push({
            filePath,
            line: line.line,
            code: "unsupported-generated-label",
            message: `Unsupported generated label reference ${reference.lexeme}`,
            startCharacter: generatedRange.start,
            endCharacter: generatedRange.end
          });
        }
        continue;
      }

      const range = resolveDiagnosticRange(line.isExpanded, reference, lineLength);

      if (reference.lexeme.startsWith("]")) {
        const definitionLine = variableDefinitionLines.get(reference.lexeme);
        if (definitionLine !== undefined) {
          if (line.line < definitionLine && !line.isExpanded && range !== null) {
            diagnostics.push({
              filePath,
              line: line.line,
              code: "unresolved-reference",
              message: `Unresolved variable reference ${reference.lexeme}`,
              startCharacter: range.start,
              endCharacter: range.end
            });
          }
          continue;
        }
      }

      if (isLocalLabel(reference.lexeme)) {
        const localReference = getLocalLabelReference(localScope, reference.lexeme, line.line);
        if (localReference === undefined || !activeLines.has(localReference.targetLine)) {
          if (!line.isExpanded && range !== null) {
            diagnostics.push({
              filePath,
              line: line.line,
              code: "unresolved-reference",
              message: `Unresolved local reference ${reference.lexeme}`,
              startCharacter: range.start,
              endCharacter: range.end
            });
          }
        }
        continue;
      }

      const equateDefinitions = equatesByName.get(reference.lexeme);
      if (
        equateDefinitions !== undefined &&
        !equateDefinitions.some((definition) => isDefinedBeforeUse(definition, documentIndex, line.line)) &&
        range !== null
      ) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "forward-equate-reference",
          message: `EQU symbol ${reference.lexeme} must be defined before use`,
          startCharacter: range.start,
          endCharacter: range.end
        });
        continue;
      }

      if (!globalSymbols.has(reference.lexeme) && range !== null) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "unresolved-reference",
          message: `Unresolved reference ${reference.lexeme}`,
          startCharacter: range.start,
          endCharacter: range.end
        });
      }
    }
  }

  return diagnostics;
}

export function collectEquateDefinitions(
  document: ParsedDocument,
  documentIndex: number,
  activeLines: ReadonlySet<number>
): readonly EquateRecord[] {
  const equates: EquateRecord[] = [];
  for (const line of document.lines) {
    if (!activeLines.has(line.line)) {
      continue;
    }
    const token = line.node.shape === "equate" && !line.node.isVariable
      ? getGlobalLabelToken(line.node)
      : null;
    if (token !== null) {
      equates.push({ name: token.lexeme, line: line.line, documentIndex });
    }
  }
  return equates;
}

export function collectGlobalDefinitions(
  document: ParsedDocument,
  filePath: string,
  activeLines: ReadonlySet<number>
): readonly SymbolRecord[] {
  const symbols: SymbolRecord[] = [];

  for (const line of document.lines) {
    if (!activeLines.has(line.line)) {
      continue;
    }
    const token = getGlobalDefinitionToken(line.node);
    if (token === null) {
      continue;
    }

    symbols.push({
      name: token.lexeme,
      line: line.line,
      filePath,
      startCharacter: token.start,
      endCharacter: token.end
    });
  }

  return symbols;
}

function getGlobalDefinitionToken(node: ParsedLine): Token | null {
  if (node.shape === "directive" && node.directive.lexeme.toLowerCase() === "mac") {
    return null;
  }
  return getGlobalLabelToken(node);
}

function findExpressionReferences(node: ParsedLine): readonly Token[] {
  if (node.shape === "instruction" && node.operand !== null) {
    return findReferencesInOperand(node.operand);
  }

  if (node.shape === "directive" && node.operand !== null) {
    const directive = directiveTable.get(node.directive.lexeme.toLowerCase());
    if (directive?.kind === "include" || directive?.kind === "build") {
      if (node.directive.lexeme.toLowerCase() === "typ") {
        const knownAliases = new Set([
          "txt", "bin", "sys", "bas", "var", "rel",
          "lib", "s16", "rtl", "exe", "pif", "tif",
          "nda", "cda", "tol", "dvr", "ldf", "fst"
        ]);
        return findReferencesInExpression(node.operand).filter(
          (ref) => !knownAliases.has(ref.lexeme.toLowerCase())
        );
      }
      return [];
    }
    const references: Token[] = [...findReferencesInExpression(node.operand)];
    for (const additionalOperand of node.additionalOperands ?? []) {
      references.push(...findReferencesInExpression(additionalOperand));
    }
    return references.filter((reference) => reference.lexeme !== "\\");
  }

  if (node.shape === "equate") {
    return findReferencesInExpression(node.expression);
  }

  if (node.shape === "data") {
    if (node.directive.lexeme.toLowerCase() === "hex") {
      return [];
    }

    const references: Token[] = [];
    for (const token of node.tokens) {
      if (token.kind === "identifier" || token.kind === "localLabel") {
        references.push(token);
      }
    }
    return references;
  }

  return [];
}

function findReferencesInOperand(operand: Operand): readonly Token[] {
  return findReferencesInExpression(operand.expression);
}

function findReferencesInExpression(expression: Expression): readonly Token[] {
  const tokens: Token[] = [];
  walkExpression(expression, (identifier) => tokens.push(identifier.token));
  return tokens;
}
