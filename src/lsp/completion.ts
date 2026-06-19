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
  const text = document.lines[line]?.node.text.trimStart().toLowerCase() ?? "";

  if (text === "ld" || text === "ld\n" || text.startsWith("ld")) {
    return opcodeDefinitions.map((opcode) => ({
      label: opcode.mnemonic,
      kind: CompletionItemKind.Keyword
    }));
  }

  if (text === "du" || text.startsWith("du")) {
    return directiveDefinitions.map((directive) => ({
      label: directive.name,
      kind: CompletionItemKind.Function
    }));
  }

  const symbols = collectSymbols(document);
  return [...symbols.values()].map((symbol) => ({
    label: symbol.name,
    kind: CompletionItemKind.Variable
  }));
}
