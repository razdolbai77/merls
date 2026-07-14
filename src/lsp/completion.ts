import {
  CompletionItem,
  CompletionItemKind
} from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { resolveLocalLabels } from "../asm/local-labels";
import { directiveDefinitions, opcodeDefinitions, directiveTable } from "../asm/metadata";
import { collectSymbols } from "../asm/symbols";

export function buildCompletionItems(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number
): CompletionItem[] {
  let operandToken: { lexeme: string; kind: string } | null = null;
  let replacementToken: { start: number; end: number } | null = null;
  let currentWordStart = character;
  const cached = openDocuments.get(uri);
  let enclosingMacro: { maxParameterIndex: number } | undefined;
  const localScope = cached === undefined ? null : resolveLocalLabels(cached.parsed);
  if (cached !== undefined) {
    const lexedLine = cached.lexed.lines[line];
    if (lexedLine !== undefined) {
      for (const token of lexedLine.tokens) {
        if (token.start < character) {
          if (token.kind === "comment" || token.kind === "string") {
            if (character <= token.end) {
              return [];
            }
          }
        }
        if (token.end < character) {
          if (
            token.kind === "mnemonic" ||
            token.kind === "directive" ||
            token.kind === "identifier"
          ) {
            operandToken = token;
          }
        }
        if (token.start <= character && character <= token.end) {
          currentWordStart = token.start;
          if (
            token.kind === "directive" ||
            token.kind === "identifier" ||
            token.kind === "localLabel" ||
            token.kind === "mnemonic"
          ) {
            replacementToken = token;
          }
        }
      }
    }

    enclosingMacro = cached.parsed.macroDefinitions.find(
      (def) => line > def.startLine && (def.endLine === null || line < def.endLine)
    );
  }

  let exclusiveCompletions: readonly string[] | null = null;
  if (operandToken !== null && operandToken.kind === "directive") {
    const directive = directiveTable.get(operandToken.lexeme.toLowerCase());
    if (directive?.completions) {
      exclusiveCompletions = directive.completions;
    }
  }

  const completions: CompletionItem[] = [];
  const seenSymbols = new Set<string>();
  const createCompletionItem = (
    label: string,
    kind: CompletionItemKind
  ): CompletionItem => {
    if (replacementToken === null) {
      return { label, kind };
    }

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

  if (exclusiveCompletions !== null) {
    for (const completion of exclusiveCompletions) {
      if (!seenSymbols.has(completion)) {
        seenSymbols.add(completion);
        completions.push(createCompletionItem(completion, CompletionItemKind.Value));
      }
    }
    return completions;
  }

  if (enclosingMacro !== undefined && operandToken !== null) {
    const maxParam = Math.max(9, enclosingMacro.maxParameterIndex);
    for (let i = 1; i <= maxParam; i++) {
      const param = `]${i}`;
      if (!seenSymbols.has(param)) {
        seenSymbols.add(param);
        completions.push(createCompletionItem(param, CompletionItemKind.Variable));
      }
    }
  }

  for (const doc of openDocuments.values()) {
    const symbols = collectSymbols(doc.parsed);
    for (const symbol of symbols.values()) {
      if (isLocalLabel(symbol.name)) {
        continue;
      }

      if (symbol.kind === "macro") {
        if (operandToken === null && !seenSymbols.has(symbol.name)) {
          seenSymbols.add(symbol.name);
          completions.push(createCompletionItem(symbol.name, CompletionItemKind.Function));
        }
      } else {
        if (!seenSymbols.has(symbol.name)) {
          seenSymbols.add(symbol.name);
          completions.push(createCompletionItem(symbol.name, CompletionItemKind.Variable));
        }
      }
    }
  }

  const currentAnchor = localScope?.anchors.get(line);
  if (currentAnchor !== undefined && localScope !== null) {
    for (const localDefinition of localScope.definitions.values()) {
      if (
        localDefinition.anchor !== currentAnchor ||
        (localDefinition.name.startsWith("]") && localDefinition.line >= line) ||
        seenSymbols.has(localDefinition.name)
      ) {
        continue;
      }

      seenSymbols.add(localDefinition.name);
      completions.push(createCompletionItem(localDefinition.name, CompletionItemKind.Variable));
    }
  }

  if (operandToken === null) {
    if (currentWordStart > 0) {
      for (const opcode of opcodeDefinitions) {
        completions.push(createCompletionItem(opcode.mnemonic, CompletionItemKind.Keyword));
      }
    }

    for (const directive of directiveDefinitions) {
      completions.push(createCompletionItem(directive.name, CompletionItemKind.Function));
    }
  }

  return completions;
}

function isLocalLabel(name: string): boolean {
  return name.startsWith("]") || name.startsWith(":");
}
