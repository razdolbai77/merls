import { type ParsedDocument } from "./document";
import {
  type Diagnostic,
  type DiagnosticCode,
  type DocumentEntry,
  type EquateRecord,
  type MacroRecord,
  type SymbolRecord
} from "./diagnostics/types";
import { collectActiveLines } from "./diagnostics/expressions";
import {
  collectDuplicateMacroDiagnostics,
  collectDuplicateSymbolDiagnostics,
  collectEquateDefinitions,
  collectGlobalDefinitions,
  collectUnresolvedDiagnostics
} from "./diagnostics/labels";
import {
  collectAddressingModeDiagnostics,
  collectDataOperandDiagnostics,
  collectLoopDiagnostics,
  collectMacroCallDiagnostics,
  collectMacroStructureDiagnostics,
  collectMalformedDiagnostics,
  collectUnknownDiagnostics
} from "./diagnostics/general";

export type { DiagnosticCode, Diagnostic, DocumentEntry };
export {
  createMacroTokenDiagnostic,
  addTokenPastedNameDiagnostic,
  addInvalidMacroLocalLabelDiagnostic,
  resolveDiagnosticRange
} from "./diagnostics/types";
export {
  collectActiveLines,
  recordConditionalValue,
  evaluateExpression,
  parseNumericLiteral
} from "./diagnostics/expressions";
export {
  collectDuplicateSymbolDiagnostics,
  collectDuplicateMacroDiagnostics,
  collectUnresolvedDiagnostics,
  collectEquateDefinitions,
  collectGlobalDefinitions,
  isDefinedBeforeUse
} from "./diagnostics/labels";
export {
  collectMalformedDiagnostics,
  collectLoopDiagnostics,
  collectDataOperandDiagnostics,
  collectUnknownDiagnostics,
  collectMacroStructureDiagnostics,
  collectMacroCallDiagnostics,
  collectAddressingModeDiagnostics
} from "./diagnostics/general";

export function collectWorkspaceDiagnostics(
  documents: readonly DocumentEntry[]
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const globalSymbols = new Set<string>();
  const symbolRecords: SymbolRecord[] = [];
  const macrosByName = new Map<string, MacroRecord[]>();
  const equatesByName = new Map<string, EquateRecord[]>();
  const activeLinesByDocument = new Map<ParsedDocument, ReadonlySet<number>>();
  const conditionalValues = new Map<string, number>();

  for (const [documentIndex, entry] of documents.entries()) {
    const activeLines = collectActiveLines(entry.document, conditionalValues);
    activeLinesByDocument.set(entry.document, activeLines);

    for (const symbol of collectGlobalDefinitions(entry.document, entry.filePath, activeLines)) {
      symbolRecords.push(symbol);
      globalSymbols.add(symbol.name);
    }

    for (const equate of collectEquateDefinitions(entry.document, documentIndex, activeLines)) {
      const definitions = equatesByName.get(equate.name) ?? [];
      definitions.push(equate);
      equatesByName.set(equate.name, definitions);
    }

    for (const macroDefinition of entry.document.macroDefinitions) {
      const current = macrosByName.get(macroDefinition.name) ?? [];
      current.push({
        name: macroDefinition.name,
        line: macroDefinition.startLine,
        filePath: entry.filePath,
        startCharacter: macroDefinition.nameToken.start,
        endCharacter: macroDefinition.nameToken.end,
        maxParameterIndex: macroDefinition.maxParameterIndex,
        usesArgumentCountParameter: macroDefinition.parameterReferences.some(
          (parameterReference) => parameterReference.index === 0
        ),
        documentIndex
      });
      macrosByName.set(macroDefinition.name, current);
    }
  }

  diagnostics.push(...collectDuplicateSymbolDiagnostics(symbolRecords));
  diagnostics.push(...collectDuplicateMacroDiagnostics(macrosByName));

  for (const [documentIndex, entry] of documents.entries()) {
    const activeLines = activeLinesByDocument.get(entry.document);
    if (activeLines === undefined) continue;

    diagnostics.push(
      ...collectMalformedDiagnostics(entry.filePath, entry.document),
      ...collectUnknownDiagnostics(entry.filePath, entry.document, entry.document.macroDefinitions),
      ...collectAddressingModeDiagnostics(
        entry.filePath,
        entry.document,
        entry.document.macroDefinitions,
        conditionalValues
      ),
      ...collectMacroStructureDiagnostics(entry.filePath, entry.document),
      ...collectUnresolvedDiagnostics(
        entry.filePath,
        entry.document,
        globalSymbols,
        entry.document.macroDefinitions,
        equatesByName,
        documentIndex,
        activeLines
      ),
      ...collectMacroCallDiagnostics(entry.filePath, entry.document, macrosByName, documentIndex),
      ...collectLoopDiagnostics(entry.filePath, entry.document),
      ...collectDataOperandDiagnostics(entry.filePath, entry.document)
    );
  }

  return diagnostics;
}
