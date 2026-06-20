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
  line: number
): CompletionItem[] {
  const cached = openDocuments.get(uri);
  const completions: CompletionItem[] = [];

  if (cached !== undefined) {
    const symbols = collectSymbols(cached.parsed);
    for (const symbol of symbols.values()) {
      completions.push({
        label: symbol.name,
        kind: CompletionItemKind.Variable
      });
    }
  }

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



  return completions;
}
