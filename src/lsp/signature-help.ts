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

  let maxParam = 0;
  let inMacro = false;
  const macroDocument = openDocuments.get(macroMatch.uri);
  for (const l of macroDocument?.parsed.lines ?? []) {
    if (l.node.shape === "directive" && l.node.label?.lexeme === macroName && l.node.directive.lexeme.toLowerCase() === "mac") {
      inMacro = true;
      continue;
    }
    if (inMacro) {
      if (l.node.shape === "directive" && (l.node.directive.lexeme.toLowerCase() === "eom" || l.node.directive.lexeme === "<<<")) {
        break;
      }
      const matches = l.node.text.match(/][1-9]/g);
      if (matches) {
        for (const m of matches) {
          const p = parseInt(m.slice(1), 10);
          if (p > maxParam) {
            maxParam = p;
          }
        }
      }
    }
  }

  const parameters: ParameterInformation[] = [];
  // Merlin macros use ]1 to ]maxParam. If maxParam is 0, maybe there are 0 params, or we just show a generic signature.
  // We'll show at least up to activeParameter + 1 if maxParam is smaller.
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
