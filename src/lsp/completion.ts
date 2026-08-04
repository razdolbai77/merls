import {
  CompletionItem,
  CompletionItemKind
} from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { type LocalLabelScope, resolveLocalLabels, isLocalLabel } from "../asm/local-labels";
import { directiveDefinitions, opcodeDefinitions, directiveTable } from "../asm/metadata";
import { collectSymbols } from "../asm/symbols";
import { type Token } from "../asm/lexer";
import { renderMacroParameters } from "./macro-signature";

type CompletionContext = {
  enclosingMacroMaxParameterIndex: number | null;
  localScope: LocalLabelScope | null;
  operandToken: Token | null;
  replacementToken: Token | null;
  currentWordStart: number;
};

type CompletionItemFactory = (label: string, kind: CompletionItemKind) => CompletionItem;

export function buildCompletionItems(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number
): CompletionItem[] {
  const context = getCompletionContext(openDocuments.get(uri), line, character);
  if (context === null || context.currentWordStart === 0) {
    return [];
  }

  const completions: CompletionItem[] = [];
  const seenSymbols = new Set(["A", "a", "X", "x", "Y", "y"]);
  const createItem = createCompletionItemFactory(line, context.replacementToken);
  const exclusiveCompletions = getDirectiveCompletions(context.operandToken);

  if (exclusiveCompletions !== null) {
    addExclusiveCompletions(exclusiveCompletions, completions, seenSymbols, createItem);
    return completions;
  }

  addMacroParameterCompletions(context, completions, seenSymbols, createItem);
  addWorkspaceSymbolCompletions(openDocuments, context, completions, seenSymbols, createItem);
  addLocalLabelCompletions(context, line, completions, seenSymbols, createItem);
  addInstructionAndDirectiveCompletions(context, completions, createItem);
  return completions;
}

function getCompletionContext(
  cached: CachedDocument | undefined,
  line: number,
  character: number
): CompletionContext | null {
  let operandToken: Token | null = null;
  let replacementToken: Token | null = null;
  let currentWordStart = character;

  if (cached !== undefined) {
    const lexedLine = cached.lexed.lines[line];
    if (lexedLine !== undefined) {
      for (const token of lexedLine.tokens) {
        if (token.start <= character && character <= token.end && (token.kind === "comment" || token.kind === "string")) {
          return null;
        }
        if (token.end < character && isOperandToken(token)) {
          operandToken = token;
        }
        if (token.start <= character && character <= token.end) {
          currentWordStart = token.start;
          if (isReplacementToken(token)) replacementToken = token;
        }
      }
    }

    const enclosingMacro = cached.parsed.macroDefinitions.find(
      (definition) => line > definition.startLine && (definition.endLine === null || line < definition.endLine)
    );
    return {
      enclosingMacroMaxParameterIndex: enclosingMacro?.maxParameterIndex ?? null,
      localScope: resolveLocalLabels(cached.parsed),
      operandToken,
      replacementToken,
      currentWordStart
    };
  }

  return {
    enclosingMacroMaxParameterIndex: null,
    localScope: null,
    operandToken,
    replacementToken,
    currentWordStart
  };
}

function isOperandToken(token: Token): boolean {
  return token.kind === "mnemonic" || token.kind === "directive" || token.kind === "identifier";
}

function isReplacementToken(token: Token): boolean {
  return (
    token.kind === "directive" ||
    token.kind === "identifier" ||
    token.kind === "localLabel" ||
    token.kind === "mnemonic"
  );
}

function createCompletionItemFactory(line: number, replacementToken: Token | null): CompletionItemFactory {
  return (label, kind) => {
    if (replacementToken === null) return { label, kind };

    return {
      label,
      kind,
      textEdit: {
        newText: label,
        range: {
          start: { line, character: replacementToken.start },
          end: { line, character: replacementToken.end }
        }
      }
    };
  };
}

function getDirectiveCompletions(operandToken: Token | null): readonly string[] | null {
  if (operandToken?.kind !== "directive") return null;
  return directiveTable.get(operandToken.lexeme.toLowerCase())?.completions ?? null;
}

function addExclusiveCompletions(
  exclusiveCompletions: readonly string[],
  completions: CompletionItem[],
  seenSymbols: Set<string>,
  createItem: CompletionItemFactory
): void {
  for (const completion of exclusiveCompletions) {
    if (!seenSymbols.has(completion)) {
      seenSymbols.add(completion);
      completions.push(createItem(completion, CompletionItemKind.Value));
    }
  }
}

function addMacroParameterCompletions(
  context: CompletionContext,
  completions: CompletionItem[],
  seenSymbols: Set<string>,
  createItem: CompletionItemFactory
): void {
  if (context.enclosingMacroMaxParameterIndex === null || context.operandToken === null) return;

  for (const parameter of renderMacroParameters(context.enclosingMacroMaxParameterIndex, 9)) {
    if (!seenSymbols.has(parameter)) {
      seenSymbols.add(parameter);
      completions.push(createItem(parameter, CompletionItemKind.Variable));
    }
  }
}

function addWorkspaceSymbolCompletions(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  context: CompletionContext,
  completions: CompletionItem[],
  seenSymbols: Set<string>,
  createItem: CompletionItemFactory
): void {
  for (const document of openDocuments.values()) {
    for (const symbol of collectSymbols(document.parsed).values()) {
      if (isLocalLabel(symbol.name) && symbol.kind !== "variable") continue;

      if (symbol.kind === "macro") {
        if (context.operandToken === null && !seenSymbols.has(symbol.name)) {
          seenSymbols.add(symbol.name);
          completions.push(createItem(symbol.name, CompletionItemKind.Function));
        }
      } else if (!seenSymbols.has(symbol.name)) {
        seenSymbols.add(symbol.name);
        completions.push(createItem(symbol.name, CompletionItemKind.Variable));
      }
    }
  }
}

function addLocalLabelCompletions(
  context: CompletionContext,
  line: number,
  completions: CompletionItem[],
  seenSymbols: Set<string>,
  createItem: CompletionItemFactory
): void {
  const currentAnchor = context.localScope?.anchors.get(line);
  if (currentAnchor === undefined || context.localScope === null) return;

  for (const definition of context.localScope.definitions.values()) {
    if (
      definition.anchor !== currentAnchor ||
      (definition.name.startsWith("]") && definition.line >= line) ||
      seenSymbols.has(definition.name)
    ) continue;

    seenSymbols.add(definition.name);
    completions.push(createItem(definition.name, CompletionItemKind.Variable));
  }
}

function addInstructionAndDirectiveCompletions(
  context: CompletionContext,
  completions: CompletionItem[],
  createItem: CompletionItemFactory
): void {
  if (context.operandToken !== null) return;

  if (context.currentWordStart > 0) {
    for (const opcode of opcodeDefinitions) {
      completions.push(createItem(opcode.mnemonic, CompletionItemKind.Keyword));
    }
  }
  for (const directive of directiveDefinitions) {
    completions.push(createItem(directive.name, CompletionItemKind.Function));
  }
}
