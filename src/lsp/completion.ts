import {
  CompletionItemKind,
  type CompletionItem
} from "vscode-languageserver/node";

import { directiveDefinitions, opcodeDefinitions } from "../asm/metadata";
import { parseDocument } from "../asm/document";
import { collectSymbols } from "../asm/symbols";

export function buildCompletionItems(
  openDocuments: ReadonlyMap<string, string>,
  uri: string,
  line: number
): CompletionItem[] {
  const source = openDocuments.get(uri);
  if (source === undefined) {
    return [];
  }

  const document = parseDocument(source);
  const completions: CompletionItem[] = [];

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

  const symbols = collectSymbols(document);
  for (const symbol of symbols.values()) {
    completions.push({
      label: symbol.name,
      kind: CompletionItemKind.Variable
    });
  }

  return completions;
}
