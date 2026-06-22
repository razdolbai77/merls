import { SignatureHelp, SignatureInformation, ParameterInformation } from "vscode-languageserver/node";
import { CachedDocument } from "../asm/document";
import { type Token } from "../asm/lexer";
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

  const macroMatch = findSymbol(openDocuments, macroName, "macro");
  if (macroMatch === null) {
    return null;
  }

  const maxParam = macroMatch.symbol.macroDefinition?.maxParameterIndex ?? 0;
  const activeParameter = countActiveParameter(node.args, character);

  const parameters: ParameterInformation[] = [];
  const displayMax = maxParam === 0 ? 0 : Math.max(maxParam, activeParameter + 1);

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

function countActiveParameter(args: readonly Token[], character: number): number {
  let activeParameter = 0;
  let depth = 0;

  for (const token of args) {
    if (token.start >= character) {
      break;
    }

    if (token.kind !== "expressionOperator") {
      continue;
    }

    if (token.lexeme === "(") {
      depth += 1;
      continue;
    }

    if (token.lexeme === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (token.lexeme === "," && depth === 0) {
      activeParameter += 1;
    }
  }

  return activeParameter;
}
