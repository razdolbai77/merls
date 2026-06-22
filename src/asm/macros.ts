import { type ParsedDocument } from "./document";
import { type CachedDocument } from "./document";

export type DocumentMacroDefinition = {
  name: string;
  line: number;
  startLine: number;
  endLine: number | null;
  bodyStartLine: number | null;
  bodyEndLine: number | null;
  maxParameterIndex: number;
  referencedSymbols: readonly string[];
  nestedCalls: readonly string[];
  localLabelDefinitions: readonly string[];
  localLabelReferences: readonly string[];
};

export type WorkspaceMacroDefinition = DocumentMacroDefinition & {
  filePath: string;
};

export function collectDocumentMacros(document: ParsedDocument): Map<string, DocumentMacroDefinition> {
  const macros = new Map<string, DocumentMacroDefinition>();

  for (const macroDefinition of document.macroDefinitions) {
    macros.set(macroDefinition.name, {
      name: macroDefinition.name,
      line: macroDefinition.startLine,
      startLine: macroDefinition.startLine,
      endLine: macroDefinition.endLine,
      bodyStartLine: macroDefinition.body[0]?.line ?? null,
      bodyEndLine: macroDefinition.body.at(-1)?.line ?? null,
      maxParameterIndex: macroDefinition.maxParameterIndex,
      referencedSymbols: uniqueLexemes(macroDefinition.symbolReferences.map((reference) => reference.token.lexeme)),
      nestedCalls: uniqueLexemes(macroDefinition.nestedMacroCalls.map((call) => call.macro.lexeme)),
      localLabelDefinitions: uniqueLexemes(macroDefinition.localLabelDefinitions.map((label) => label.token.lexeme)),
      localLabelReferences: uniqueLexemes(macroDefinition.localLabelReferences.map((label) => label.token.lexeme))
    });
  }

  return macros;
}

export function collectWorkspaceMacros(
  documents: ReadonlyMap<string, CachedDocument>
): Map<string, WorkspaceMacroDefinition[]> {
  const macros = new Map<string, WorkspaceMacroDefinition[]>();

  for (const [filePath, document] of documents.entries()) {
    for (const macro of collectDocumentMacros(document.parsed).values()) {
      const currentDefinitions = macros.get(macro.name) ?? [];
      currentDefinitions.push({
        ...macro,
        filePath
      });
      macros.set(macro.name, currentDefinitions);
    }
  }

  return macros;
}

function uniqueLexemes(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
