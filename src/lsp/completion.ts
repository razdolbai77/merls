import {
  CompletionItem,
  CompletionItemKind
} from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { directiveDefinitions, opcodeDefinitions, directiveTable } from "../asm/metadata";
import { collectSymbols } from "../asm/symbols";

export function buildCompletionItems(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number
): CompletionItem[] {
  let operandToken: { lexeme: string; kind: string } | null = null;
  const cached = openDocuments.get(uri);
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
          if (token.kind === "mnemonic" || token.kind === "directive") {
            operandToken = token;
          }
        }
      }
    }
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

  if (exclusiveCompletions !== null) {
    for (const completion of exclusiveCompletions) {
      if (!seenSymbols.has(completion)) {
        seenSymbols.add(completion);
        completions.push({
          label: completion,
          kind: CompletionItemKind.Value
        });
      }
    }
    return completions;
  }

  for (const doc of openDocuments.values()) {
    const symbols = collectSymbols(doc.parsed);
    for (const symbol of symbols.values()) {
      if (!seenSymbols.has(symbol.name)) {
        seenSymbols.add(symbol.name);
        completions.push({
          label: symbol.name,
          kind: CompletionItemKind.Variable
        });
      }
    }
  }

  if (operandToken === null) {
    for (const opcode of opcodeDefinitions) {
      completions.push({
        label: opcode.mnemonic,
        kind: CompletionItemKind.Keyword
      });
    }

    for (const directive of directiveDefinitions) {
      completions.push({
        label: directive.name,
        kind: CompletionItemKind.Function
      });
    }
  }



  return completions;
}
