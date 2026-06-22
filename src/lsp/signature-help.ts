import { SignatureHelp, SignatureInformation, ParameterInformation } from "vscode-languageserver/node";
import { CachedDocument } from "../asm/document";
import { findSymbol } from "../asm/symbols";

export function buildSignatureHelp(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number
): SignatureHelp | null {
  const cached = openDocuments.get(uri);
  if (cached === undefined) {
    return null;
  }

  const parsedLine = cached.parsed.lines[line];
  if (parsedLine === undefined || parsedLine.node.shape !== "macroCall") {
    return null;
  }

  const node = parsedLine.node;
  const macroName = node.macro.lexeme;

  // determine active parameter
  let activeParameter = 0;
  for (const arg of node.args) {
    if (arg.kind === "expressionOperator" && arg.lexeme === ",") {
      if (character >= arg.start) {
        activeParameter++;
      }
    }
  }

  const macroMatch = findSymbol(openDocuments, macroName, "macro");
  if (macroMatch === null) {
    return null;
  }

  const maxParam = macroMatch.symbol.macroDefinition?.maxParameterIndex ?? 0;

  const parameters: ParameterInformation[] = [];
  const displayMax = Math.max(maxParam, activeParameter + 1);

  for (let i = 1; i <= displayMax; i++) {
    parameters.push({
      label: `]${i}`
    });
  }

  const signature: SignatureInformation = {
    label: `${macroName}(${parameters.map(p => p.label).join(", ")})`,
    parameters
  };

  return {
    signatures: [signature],
    activeSignature: 0,
    activeParameter
  };
}
