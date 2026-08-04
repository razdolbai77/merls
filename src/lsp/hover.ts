import { type Hover } from "vscode-languageserver/node";

import { directiveTable, opcodeTable } from "../asm/metadata";
import { type CachedDocument, type DocumentLine } from "../asm/document";
import { type Token, tokenAtCharacter } from "../asm/lexer";
import { type ParsedLine } from "../asm/parser";
import { renderMacroParameters } from "./macro-signature";
import { findDefinition } from "./symbol-navigation";
import { findSymbol, getDocComment } from "../asm/symbols";

export function buildHover(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  character: number
): Hover | null {
  const cached = openDocuments.get(uri);
  if (cached === undefined) return null;

  const documentLine = cached.parsed.lines[line];
  const lexedLine = cached.lexed.lines[line];
  if (documentLine === undefined || lexedLine === undefined) return null;

  const token = tokenAtCharacter(lexedLine.tokens, character);
  const tokenHover = token === null
    ? undefined
    : buildTokenHover(openDocuments, uri, line, token, documentLine, lexedLine.tokens);
  return tokenHover === undefined ? buildNodeHover(documentLine.node) : tokenHover;
}

function buildTokenHover(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  token: Token,
  documentLine: DocumentLine,
  tokens: readonly Token[]
): Hover | null | undefined {
  if (token.kind === "mnemonic") return buildOpcodeHover(token.lexeme) ?? undefined;
  if (token.kind === "directive") return buildDirectiveHover(token.lexeme) ?? undefined;
  if (token.kind === "identifier" || token.kind === "label" || token.kind === "localLabel") {
    return buildIdentifierHover(openDocuments, uri, line, token, documentLine, tokens);
  }
  return undefined;
}

function buildIdentifierHover(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  token: Token,
  documentLine: DocumentLine,
  tokens: readonly Token[]
): Hover | null | undefined {
  if (isRegisterToken(token, tokens)) {
    return { contents: `Register ${token.lexeme.toUpperCase()}` };
  }
  if ("label" in documentLine.node && documentLine.node.label?.start === token.start) return null;

  const macroHover = buildMacroHover(openDocuments, token, documentLine);
  if (macroHover !== undefined) return macroHover;
  return buildSymbolHover(openDocuments, uri, line, token);
}

function isRegisterToken(token: Token, tokens: readonly Token[]): boolean {
  const lexeme = token.lexeme.toLowerCase();
  if (lexeme !== "x" && lexeme !== "y") return false;

  const tokenIndex = tokens.indexOf(token);
  return tokenIndex > 0 && tokens[tokenIndex - 1]?.lexeme === ",";
}

function buildMacroHover(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  token: Token,
  documentLine: DocumentLine
): Hover | undefined {
  if (documentLine.node.shape !== "macroCall" || documentLine.node.macro.start !== token.start) return undefined;

  const macroSymbol = findSymbol(openDocuments, token.lexeme, "macro");
  if (macroSymbol === null) return undefined;

  const parameterLabels = renderMacroParameters(macroSymbol.symbol.macroDefinition?.maxParameterIndex ?? 0);
  let contents = `Macro ${token.lexeme}(${parameterLabels.join(", ")}) defined at line ${macroSymbol.symbol.line + 1}`;
  if (macroSymbol.symbol.docComment !== undefined) {
    contents += `\n\n${macroSymbol.symbol.docComment}`;
  }
  return { contents };
}


function buildSymbolHover(
  openDocuments: ReadonlyMap<string, CachedDocument>,
  uri: string,
  line: number,
  token: Token
): Hover | undefined {
  const definitions = findDefinition(openDocuments, uri, line, token.start);
  if (definitions === null) return undefined;

  const definition = Array.isArray(definitions) ? definitions[0] : definitions;
  if (definition === undefined) return undefined;

  const definitionDocument = openDocuments.get(definition.uri);
  const docComment = definitionDocument === undefined
    ? undefined
    : getDocComment(definitionDocument.parsed, definition.range.start.line);
  const fileDescription = definition.uri === uri
    ? "defined"
    : `defined in ${definition.uri.split("/").pop()}`;
  let contents = `Symbol ${token.lexeme} ${fileDescription} at line ${definition.range.start.line + 1}`;
  if (docComment !== undefined) contents += `\n\n${docComment}`;
  return { contents };
}

function buildNodeHover(node: ParsedLine): Hover | null {
  if (node.shape === "instruction") return buildOpcodeHover(node.mnemonic.lexeme);
  if (node.shape === "directive") return buildDirectiveHover(node.directive.lexeme);
  return null;
}

function buildOpcodeHover(mnemonic: string): Hover | null {
  const definition = opcodeTable.get(mnemonic.toLowerCase());
  if (definition === undefined) return null;
  return {
    contents: `Opcode ${definition.mnemonic}: ${definition.description}\n\nModes: ${definition.modes.join(", ")}`
  };
}

function buildDirectiveHover(name: string): Hover | null {
  const definition = directiveTable.get(name.toLowerCase());
  return definition === undefined ? null : { contents: `Directive ${definition.name}: ${definition.summary}` };
}
