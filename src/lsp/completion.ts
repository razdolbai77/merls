import {
  CompletionItem,
  CompletionItemKind
} from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { directiveDefinitions, opcodeDefinitions } from "../asm/metadata";
import { collectSymbols } from "../asm/symbols";

export function buildCompletionItems(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number
): CompletionItem[] {
  let inOperand = false;
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
            inOperand = true;
          }
        }
      }
    }
  }

  const completions: CompletionItem[] = [];
  const seenSymbols = new Set<string>();

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

  if (!inOperand) {
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
