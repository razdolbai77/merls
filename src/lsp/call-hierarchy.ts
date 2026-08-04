import { CallHierarchyItem, CallHierarchyIncomingCall, CallHierarchyOutgoingCall, SymbolKind } from "vscode-languageserver/node";
import { CachedDocument } from "../asm/document";
import { ParsedLine } from "../asm/parser";
import { getSymbolAtPosition, collectDefinitions, collectReferences, getReferencedTokens } from "./symbol-navigation";
import { getEffectiveLines, type ExpandedToken } from "../asm/expansion";

function getEnclosingGlobalLabel(parsed: CachedDocument["parsed"], lineIndex: number): { line: number, node: ParsedLine } | null {
  for (let i = lineIndex; i >= 0; i--) {
    const pLine = parsed.lines[i];
    if (pLine && "label" in pLine.node && pLine.node.label) {
      if (pLine.node.label.kind === "label") {
        return { line: pLine.line, node: pLine.node };
      }
    }
  }
  return null;
}

function createCallHierarchyItem(uri: string, name: string, lineIndex: number, labelStart: number, labelLength: number): CallHierarchyItem {
  return {
    name,
    kind: SymbolKind.Function,
    uri,
    range: {
      start: { line: lineIndex, character: 0 },
      end: { line: lineIndex, character: labelStart + labelLength }
    },
    selectionRange: {
      start: { line: lineIndex, character: labelStart },
      end: { line: lineIndex, character: labelStart + labelLength }
    }
  };
}

export function prepareCallHierarchy(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number
): CallHierarchyItem[] | null {
  const cached = openDocuments.get(uri);
  if (!cached) return null;

  const targetName = getSymbolAtPosition(cached, line, character);
  if (!targetName) return null;

  const items: CallHierarchyItem[] = [];

  for (const [docUri, docCached] of openDocuments.entries()) {
    const definitions = collectDefinitions(docUri, docCached);
    for (const def of definitions) {
      if (def.name === targetName) {
        const defLineIndex = def.location.range.start.line;
        const pLine = docCached.parsed.lines[defLineIndex];
        if (pLine && "label" in pLine.node && pLine.node.label) {
          items.push(createCallHierarchyItem(
            def.location.uri,
            def.name,
            defLineIndex,
            pLine.node.label.start,
            pLine.node.label.lexeme.length
          ));
        }
      }
    }
  }

  return items.length > 0 ? items : null;
}

export function provideCallHierarchyIncomingCalls(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  item: CallHierarchyItem
): CallHierarchyIncomingCall[] | null {
  const incoming = new Map<string, CallHierarchyIncomingCall>();

  for (const [docUri, docCached] of openDocuments.entries()) {
    const references = collectReferences(docUri, docCached);
    for (const ref of references) {
      if (ref.name === item.name) {
        const refLineIndex = ref.location.range.start.line;
        const pLine = docCached.parsed.lines[refLineIndex];
        if (!pLine || pLine.node.shape !== "instruction") continue;

        const mnemonic = pLine.node.mnemonic.lexeme.toLowerCase();
        if (mnemonic !== "jsr" && mnemonic !== "jmp") continue;

        const enclosing = getEnclosingGlobalLabel(docCached.parsed, refLineIndex);
        if (!enclosing || !("label" in enclosing.node) || !enclosing.node.label) continue;

        const callerName = enclosing.node.label.lexeme;
        const callerUri = docUri;
        const key = `${callerUri}#${callerName}`;

        let incomingCall = incoming.get(key);
        if (!incomingCall) {
          incomingCall = {
            from: createCallHierarchyItem(
              callerUri,
              callerName,
              enclosing.line,
              enclosing.node.label.start,
              callerName.length
            ),
            fromRanges: []
          };
          incoming.set(key, incomingCall);
        }

        incomingCall.fromRanges.push(ref.location.range);
      }
    }
  }

  return incoming.size > 0 ? Array.from(incoming.values()) : null;
}

export function provideCallHierarchyOutgoingCalls(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  item: CallHierarchyItem
): CallHierarchyOutgoingCall[] | null {
  const cached = openDocuments.get(item.uri);
  if (!cached) return null;

  const startLine = item.range.start.line;
  const pLine = cached.parsed.lines[startLine];
  if (!pLine || !("label" in pLine.node) || !pLine.node.label) return null;

  const outgoing = new Map<string, CallHierarchyOutgoingCall>();

  const allMacros = Array.from(openDocuments.values()).flatMap((doc) => doc.parsed.macroDefinitions);
  const effectiveLines = getEffectiveLines(cached.parsed, allMacros);

  for (let i = 0; i < effectiveLines.length; i++) {
    const effectiveLine = effectiveLines[i];
    if (effectiveLine.line <= startLine) continue;

    if (!effectiveLine.isExpanded && "label" in effectiveLine.node && effectiveLine.node.label && effectiveLine.node.label.kind === "label") {
      break; 
    }

    if (effectiveLine.node.shape === "instruction") {
      const mnemonic = effectiveLine.node.mnemonic.lexeme.toLowerCase();
      if (mnemonic === "jsr" || mnemonic === "jmp") {
        const refs = getReferencedTokens(cached, effectiveLine.line, effectiveLine.node);
        let targetName: string | null = null;
        let targetTokenStart = 0;
        let targetTokenLength = 0;

        for (const t of refs) {
          if (t.kind === "identifier" || t.kind === "localLabel" || t.kind === "label") {
            if (effectiveLine.isExpanded) {
              if (!(t as ExpandedToken).callSiteToken) continue;
            }
            const sourceToken = "callSiteToken" in t
              ? ((t as ExpandedToken).callSiteToken ?? t)
              : t;

            targetName = t.lexeme;
            targetTokenStart = sourceToken.start;
            targetTokenLength = sourceToken.end - sourceToken.start;
            break;
          }
        }

        if (targetName) {
          for (const [docUri, docCached] of openDocuments.entries()) {
            const definitions = collectDefinitions(docUri, docCached);
            for (const def of definitions) {
              if (def.name === targetName) {
                const defLineIndex = def.location.range.start.line;
                const defLine = docCached.parsed.lines[defLineIndex];
                if (defLine && "label" in defLine.node && defLine.node.label) {
                  const key = `${def.location.uri}#${def.name}`;
                  let outgoingCall = outgoing.get(key);
                  if (!outgoingCall) {
                    outgoingCall = {
                      to: createCallHierarchyItem(
                        def.location.uri,
                        def.name,
                        defLineIndex,
                        defLine.node.label.start,
                        def.name.length
                      ),
                      fromRanges: []
                    };
                    outgoing.set(key, outgoingCall);
                  }
                  outgoingCall.fromRanges.push({
                    start: { line: effectiveLine.line, character: targetTokenStart },
                    end: { line: effectiveLine.line, character: targetTokenStart + targetTokenLength }
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return outgoing.size > 0 ? Array.from(outgoing.values()) : null;
}
