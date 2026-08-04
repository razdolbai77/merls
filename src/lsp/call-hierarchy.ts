import { type CallHierarchyItem, type CallHierarchyIncomingCall, type CallHierarchyOutgoingCall, SymbolKind } from "vscode-languageserver/node";

import { type CachedDocument } from "../asm/document";
import { getEffectiveLines, type EffectiveLine, type ExpandedToken } from "../asm/expansion";
import { getGlobalLabelToken } from "../asm/local-labels";
import { type ParsedLine } from "../asm/parser";
import {
  type SymbolDefinition,
  getSymbolAtPosition,
  collectDefinitions,
  collectReferences,
  getReferencedTokens
} from "./symbol-navigation";

type OutgoingTarget = {
  name: string;
  sourceStart: number;
  sourceLength: number;
};

function getWorkspaceMacroDefinitions(openDocuments: ReadonlyMap<string, CachedDocument>) {
  return Array.from(openDocuments.values()).flatMap((document) => document.parsed.macroDefinitions);
}

function getEnclosingGlobalLabel(parsed: CachedDocument["parsed"], lineIndex: number): { line: number, node: ParsedLine } | null {
  for (let i = lineIndex; i >= 0; i--) {
    const parsedLine = parsed.lines[i];
    if (parsedLine && getGlobalLabelToken(parsedLine.node) !== null) {
      return { line: parsedLine.line, node: parsedLine.node };
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
    for (const definition of definitions) {
      if (definition.name === targetName) {
        const definitionLineIndex = definition.location.range.start.line;
        const parsedLine = docCached.parsed.lines[definitionLineIndex];
        if (parsedLine && "label" in parsedLine.node && parsedLine.node.label) {
          items.push(createCallHierarchyItem(
            definition.location.uri,
            definition.name,
            definitionLineIndex,
            parsedLine.node.label.start,
            parsedLine.node.label.lexeme.length
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
        const parsedLine = docCached.parsed.lines[refLineIndex];
        if (!parsedLine || parsedLine.node.shape !== "instruction") continue;

        const mnemonic = parsedLine.node.mnemonic.lexeme.toLowerCase();
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
  if (cached === undefined) return null;

  const startLine = item.range.start.line;
  const sourceLine = cached.parsed.lines[startLine];
  if (sourceLine === undefined || !("label" in sourceLine.node) || sourceLine.node.label === null) return null;

  const outgoing = new Map<string, CallHierarchyOutgoingCall>();
  const allMacros = getWorkspaceMacroDefinitions(openDocuments);
  for (const effectiveLine of getEffectiveLines(cached.parsed, allMacros)) {
    if (effectiveLine.line <= startLine) continue;
    if (startsNextGlobalLabel(effectiveLine)) break;

    const target = getOutgoingTarget(cached, effectiveLine);
    if (target !== null) {
      addOutgoingTargetDefinitions(openDocuments, outgoing, effectiveLine, target);
    }
  }
  return outgoing.size > 0 ? Array.from(outgoing.values()) : null;
}

function startsNextGlobalLabel(line: EffectiveLine): boolean {
  return (
    !line.isExpanded &&
    "label" in line.node &&
    line.node.label !== null &&
    line.node.label.kind === "label"
  );
}

function getOutgoingTarget(cached: CachedDocument, line: EffectiveLine): OutgoingTarget | null {
  if (line.node.shape !== "instruction") return null;

  const mnemonic = line.node.mnemonic.lexeme.toLowerCase();
  if (mnemonic !== "jsr" && mnemonic !== "jmp") return null;

  for (const token of getReferencedTokens(cached, line.line, line.node)) {
    if (token.kind !== "identifier" && token.kind !== "localLabel" && token.kind !== "label") continue;

    const expandedToken = token as ExpandedToken;
    if (line.isExpanded && !expandedToken.callSiteToken) continue;
    const sourceToken = "callSiteToken" in token ? (expandedToken.callSiteToken ?? token) : token;
    return {
      name: token.lexeme,
      sourceStart: sourceToken.start,
      sourceLength: sourceToken.end - sourceToken.start
    };
  }
  return null;
}

function addOutgoingTargetDefinitions(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  outgoing: Map<string, CallHierarchyOutgoingCall>,
  effectiveLine: EffectiveLine,
  target: OutgoingTarget
): void {
  for (const [documentUri, document] of openDocuments.entries()) {
    for (const definition of collectDefinitions(documentUri, document)) {
      if (definition.name !== target.name) continue;

      const definitionLine = document.parsed.lines[definition.location.range.start.line];
      if (definitionLine === undefined || !("label" in definitionLine.node) || definitionLine.node.label === null) continue;
      addOutgoingCall(
        outgoing,
        definition,
        definitionLine.node.label.start,
        effectiveLine.line,
        target
      );
    }
  }
}

function addOutgoingCall(
  outgoing: Map<string, CallHierarchyOutgoingCall>,
  definition: SymbolDefinition,
  labelStart: number,
  sourceLine: number,
  target: OutgoingTarget
): void {
  const key = `${definition.location.uri}#${definition.name}`;
  let outgoingCall = outgoing.get(key);
  if (outgoingCall === undefined) {
    outgoingCall = {
      to: createCallHierarchyItem(
        definition.location.uri,
        definition.name,
        definition.location.range.start.line,
        labelStart,
        definition.name.length
      ),
      fromRanges: []
    };
    outgoing.set(key, outgoingCall);
  }
  outgoingCall.fromRanges.push({
    start: { line: sourceLine, character: target.sourceStart },
    end: { line: sourceLine, character: target.sourceStart + target.sourceLength }
  });
}
