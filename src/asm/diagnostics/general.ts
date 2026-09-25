import { type ParsedDocument } from "../document";
import { type Operand } from "../expression";
import { type Token } from "../lexer";
import { directiveTable, normalizeMnemonic, opcodeTable, type AddressingMode } from "../metadata";
import {
  isAssemblyEndDirective,
  splitTopLevelCommaTokens,
  type MacroDefinitionRegion,
  type ParsedLine
} from "../parser";
import { getEffectiveLines, splitMacroCallArguments } from "../expansion";
import { MAX_MACRO_EXPANSION_DEPTH, MAX_MACRO_EXPANSION_LINES } from "../limits";
import {
  type Diagnostic,
  type MacroRecord,
  addInvalidMacroLocalLabelDiagnostic,
  addTokenPastedNameDiagnostic,
  resolveDiagnosticRange
} from "./types";
import { evaluateExpression } from "./expressions";

export function collectMalformedDiagnostics(
  filePath: string,
  document: ParsedDocument
): readonly Diagnostic[] {
  const assemblyEndLine = getDocumentAssemblyEndLine(document);
  return document.errors
    .filter((error) => assemblyEndLine === null || error.line <= assemblyEndLine)
    .map((error) => ({
      filePath,
      line: error.line,
      code: "malformed-line" as const,
      message: error.message
    }));
}

export function collectLoopDiagnostics(
  filePath: string,
  document: ParsedDocument
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const assemblyEndLine = getDocumentAssemblyEndLine(document);
  const isActive = (line: number): boolean =>
    assemblyEndLine === null || line <= assemblyEndLine;

  for (const region of document.loopRegions) {
    if (!isActive(region.startLine)) {
      continue;
    }
    if (region.endLine === null) {
      diagnostics.push({
        filePath,
        line: region.startLine,
        code: "unterminated-loop",
        message: "Unterminated LUP region",
        startCharacter: region.startDirective.start,
        endCharacter: region.startDirective.end
      });
    }
  }

  for (const terminator of document.unmatchedLoopTerminators) {
    if (!isActive(terminator.line)) {
      continue;
    }
    diagnostics.push({
      filePath,
      line: terminator.line,
      code: "unmatched-loop-terminator",
      message: "Unmatched loop terminator --^",
      startCharacter: terminator.token.start,
      endCharacter: terminator.token.end
    });
  }

  for (const line of document.lines) {
    if (!isActive(line.line)) {
      continue;
    }
    const firstToken = line.tokens[0];
    if (firstToken?.kind === "label" && firstToken.lexeme.startsWith("@")) {
      diagnostics.push({
        filePath,
        line: line.line,
        code: "unsupported-generated-label",
        message: `Unsupported generated label ${firstToken.lexeme}`,
        startCharacter: firstToken.start,
        endCharacter: firstToken.end
      });
    }
  }

  return diagnostics;
}

function getDocumentAssemblyEndLine(document: ParsedDocument): number | null {
  const endLine = document.lines.findIndex((line) => isAssemblyEndDirective(line.node));
  return endLine === -1 ? null : endLine;
}

export function collectDataOperandDiagnostics(
  filePath: string,
  document: ParsedDocument
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const assemblyEndLine = getDocumentAssemblyEndLine(document);

  for (const line of document.lines) {
    if (assemblyEndLine !== null && line.line > assemblyEndLine) {
      continue;
    }
    const node = line.node;

    if (node.shape === "directive" && node.directive.lexeme.toLowerCase() === "ds") {
      if (node.additionalOperands !== undefined && node.additionalOperands.length > 1) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "invalid-data-operand",
          message: "DS accepts at most two operands: count and optional fill",
          startCharacter: node.directive.start,
          endCharacter: node.directive.end
        });
      }

      if (
        node.operand?.kind === "identifier" &&
        node.operand.value === "\\" &&
        !hasPrecedingDsLine(document, line.line)
      ) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "invalid-data-operand",
          message: "DS continuation \\ requires a preceding DS line",
          startCharacter: node.operand.token.start,
          endCharacter: node.operand.token.end
        });
      }
      continue;
    }

    if (node.shape === "data" && node.directive.lexeme.toLowerCase() === "asc") {
      const segments = splitTopLevelCommaTokens(node.tokens);
      if (segments.some((segment) => segment.length === 0)) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "invalid-data-operand",
          message: "Empty ASC operand segment",
          startCharacter: node.directive.start,
          endCharacter: node.directive.end
        });
      }
      continue;
    }

    if (node.shape === "data") {
      const directiveName = node.directive.lexeme.toLowerCase();
      if (directiveName === "inv" || directiveName === "fls") {
        for (const token of node.tokens) {
          if (token.kind === "string" && /[a-z]/.test(token.lexeme)) {
            diagnostics.push({
              filePath,
              line: line.line,
              code: "invalid-data-operand",
              message:
                `${node.directive.lexeme.toUpperCase()} string contains lowercase characters; ` +
                `${directiveName === "inv" ? "inverse" : "flashing"} text only supports uppercase, digits, and punctuation`,
              startCharacter: token.start,
              endCharacter: token.end
            });
          }
        }
      }
    }
  }

  return diagnostics;
}

function hasPrecedingDsLine(document: ParsedDocument, line: number): boolean {
  for (let index = line - 1; index >= 0; index--) {
    const node = document.lines[index]?.node;
    if (node === undefined || node.shape === "empty" || node.shape === "commentOnly") {
      continue;
    }
    return node.shape === "directive" && node.directive.lexeme.toLowerCase() === "ds";
  }
  return false;
}

export function collectUnknownDiagnostics(
  filePath: string,
  document: ParsedDocument,
  macroDefinitions: readonly MacroDefinitionRegion[]
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const effectiveLines = getEffectiveLines(document, macroDefinitions);
  const assemblyEndLine = getDocumentAssemblyEndLine(document);

  for (const line of effectiveLines) {
    if (assemblyEndLine !== null && line.line > assemblyEndLine) {
      continue;
    }
    const lineLength = document.lines[line.line]?.node.text.length ?? 0;

    if (line.isExpanded) {
      const invalidHexPayload = getInvalidHexPayloadToken(line.node);
      if (invalidHexPayload !== null) {
        const range = resolveDiagnosticRange(line.isExpanded, invalidHexPayload, lineLength);
        if (range !== null) {
          diagnostics.push({
            filePath,
            line: line.line,
            code: "unknown-syntax",
            message: `Unknown syntax: ${invalidHexPayload.lexeme}`,
            startCharacter: range.start,
            endCharacter: range.end
          });
        }
      }
      continue;
    }

    if (line.node.shape === "empty" || line.node.shape === "commentOnly") {
      continue;
    }

    const unknownDirectiveToken = getUnknownDirectiveToken(line.node);
    if (unknownDirectiveToken !== null) {
      const range = resolveDiagnosticRange(line.isExpanded, unknownDirectiveToken, lineLength);
      if (range !== null) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "unknown-directive",
          message: `Unknown directive: ${unknownDirectiveToken.lexeme}`,
          startCharacter: range.start,
          endCharacter: range.end
        });
      }
    }

    const invalidHexPayload = getInvalidHexPayloadToken(line.node);
    if (invalidHexPayload !== null) {
      const range = resolveDiagnosticRange(line.isExpanded, invalidHexPayload, lineLength);
      if (range !== null) {
        diagnostics.push({
          filePath,
          line: line.line,
          code: "unknown-syntax",
          message: `Unknown syntax: ${invalidHexPayload.lexeme}`,
          startCharacter: range.start,
          endCharacter: range.end
        });
      }
    }

    const tokens = document.lines[line.line]?.tokens ?? [];
    const textToAnalyze = maskIgnoredTokens(line.node.text, tokens);
    const unknownTextMatch = getUnknownTextPattern(textToAnalyze);
    if (unknownTextMatch !== null) {
      diagnostics.push({
        filePath,
        line: line.line,
        code: "unknown-syntax",
        message: `Unknown syntax: ${unknownTextMatch.text}`,
        startCharacter: unknownTextMatch.start,
        endCharacter: unknownTextMatch.end
      });
    }
  }

  return diagnostics;
}

export function collectMacroStructureDiagnostics(
  filePath: string,
  document: ParsedDocument
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let lineLimitReported = false;

  function traceCalls(
    defName: string,
    callLine: number,
    start: number,
    end: number,
    stack: ReadonlySet<string>,
    depth: number,
    budget: { remaining: number }
  ) {
    if (stack.has(defName)) {
      diagnostics.push({
        filePath,
        line: callLine,
        code: "macro-recursion",
        message: `Recursive macro call detected for ${defName}`,
        startCharacter: start,
        endCharacter: end
      });
      return;
    }
    if (depth >= MAX_MACRO_EXPANSION_DEPTH) {
      diagnostics.push({
        filePath,
        line: callLine,
        code: "deep-macro-expansion",
        message: `Macro expansion depth exceeded`,
        startCharacter: start,
        endCharacter: end
      });
      return;
    }

    const macroDefinition = document.macroDefinitions.find(
      (definition) => definition.name === defName
    );
    if (macroDefinition === undefined) return;

    if (budget.remaining < macroDefinition.body.length) {
      if (!lineLimitReported) {
        lineLimitReported = true;
        diagnostics.push({
          filePath,
          line: callLine,
          code: "deep-macro-expansion",
          message: `Macro expansion line limit exceeded`,
          startCharacter: start,
          endCharacter: end
        });
      }
      return;
    }
    budget.remaining -= macroDefinition.body.length;

    const newStack = new Set(stack);
    newStack.add(defName);

    for (const bodyLine of macroDefinition.body) {
      for (const nested of bodyLine.nestedMacroCalls) {
        traceCalls(nested.macro.lexeme, callLine, start, end, newStack, depth + 1, budget);
      }
    }
  }

  for (const macroDefinition of document.macroDefinitions) {
    if (macroDefinition.endLine === null) {
      diagnostics.push({
        filePath,
        line: macroDefinition.startLine,
        code: "missing-macro-end",
        message: `Macro ${macroDefinition.name} is missing a closing eom/<<<`,
        startCharacter: macroDefinition.nameToken.start,
        endCharacter: macroDefinition.nameToken.end
      });
    }

    for (const bodyLine of macroDefinition.body) {
      for (const nested of bodyLine.nestedMacroCalls) {
        traceCalls(
          nested.macro.lexeme,
          bodyLine.line,
          nested.macro.start,
          nested.macro.end,
          new Set([macroDefinition.name]),
          1,
          { remaining: MAX_MACRO_EXPANSION_LINES }
        );
      }

      for (const ref of bodyLine.symbolReferences) {
        addTokenPastedNameDiagnostic(diagnostics, filePath, bodyLine.line, ref.token);
      }

      for (const ref of bodyLine.localLabelDefinitions) {
        addTokenPastedNameDiagnostic(diagnostics, filePath, bodyLine.line, ref.token);
        addInvalidMacroLocalLabelDiagnostic(diagnostics, filePath, bodyLine.line, ref.token);
      }

      for (const ref of bodyLine.localLabelReferences) {
        addTokenPastedNameDiagnostic(diagnostics, filePath, bodyLine.line, ref.token);
        addInvalidMacroLocalLabelDiagnostic(diagnostics, filePath, bodyLine.line, ref.token);
      }

      for (const call of bodyLine.nestedMacroCalls) {
        addTokenPastedNameDiagnostic(diagnostics, filePath, bodyLine.line, call.macro, "macro name");
      }

      const bodyNode = bodyLine.node;
      if (bodyNode.shape === "directive") {
        const lexeme = bodyNode.directive.lexeme.toLowerCase();
        if (lexeme === "do" || lexeme === "if" || lexeme === "else" || lexeme === "fin") {
          diagnostics.push({
            filePath,
            line: bodyLine.line,
            code: "unresolved-conditional",
            message: `Conditional assembly directive ${bodyNode.directive.lexeme} inside macro cannot be statically resolved`,
            startCharacter: bodyNode.directive.start,
            endCharacter: bodyNode.directive.end
          });
        }
      }
    }
  }

  return diagnostics;
}

export function collectMacroCallDiagnostics(
  filePath: string,
  document: ParsedDocument,
  macrosByName: ReadonlyMap<string, readonly MacroRecord[]>,
  documentIndex: number
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const macroCall of document.macroCalls) {
    const definitions = macrosByName.get(macroCall.macro.lexeme);
    if (definitions === undefined) {
      diagnostics.push({
        filePath,
        line: macroCall.line,
        code: "unsupported-instruction",
        message: `Unsupported instruction or undefined macro: ${macroCall.macro.lexeme}`,
        startCharacter: macroCall.macro.start,
        endCharacter: macroCall.macro.end
      });
      continue;
    }

    const definition = definitions.find((candidate) =>
      candidate.documentIndex < documentIndex ||
      (candidate.documentIndex === documentIndex && candidate.line <= macroCall.line)
    );
    if (definition === undefined) {
      diagnostics.push({
        filePath,
        line: macroCall.line,
        code: "forward-macro-call",
        message: `Macro ${macroCall.macro.lexeme} must be defined before use`,
        startCharacter: macroCall.macro.start,
        endCharacter: macroCall.macro.end
      });
      continue;
    }
    const requiredArity = definition.maxParameterIndex;
    const actualArity = splitMacroCallArguments(macroCall.args).length;
    if (!definition.usesArgumentCountParameter && requiredArity !== actualArity) {
      diagnostics.push({
        filePath,
        line: macroCall.line,
        code: "macro-arity-mismatch",
        message: `Macro ${macroCall.macro.lexeme} expected ${requiredArity} argument(s) but received ${actualArity}`,
        startCharacter: macroCall.macro.start,
        endCharacter: macroCall.macro.end
      });
    }
  }

  return diagnostics;
}

function getUnknownDirectiveToken(node: ParsedLine): Token | null {
  if (node.shape !== "directive") {
    return null;
  }

  const directiveName = node.directive.lexeme.toLowerCase();
  if (directiveName === "eom" || node.directive.lexeme === "<<<") {
    return null;
  }

  const directive = directiveTable.get(directiveName);
  if (directive?.supported === false) {
    return node.directive;
  }

  return null;
}

function maskIgnoredTokens(text: string, tokens: readonly Token[]): string {
  let masked = text;
  for (const token of tokens) {
    if (token.kind === "comment" || token.kind === "string") {
      const start = Math.max(0, Math.min(token.start, masked.length));
      const end = Math.max(start, Math.min(token.end, masked.length));
      masked = masked.slice(0, start) + " ".repeat(end - start) + masked.slice(end);
    }
  }
  return masked;
}

function getUnknownTextPattern(text: string): { text: string; start: number; end: number } | null {
  const caretMatch = /(?<!--)\^/.exec(text);
  if (caretMatch !== null) {
    return { text: "^", start: caretMatch.index, end: caretMatch.index + 1 };
  }

  const pipeMatch = /\|/.exec(text);
  if (pipeMatch !== null) {
    return { text: "|", start: pipeMatch.index, end: pipeMatch.index + 1 };
  }

  const modifierMatch = /\b(lda|sta|cmp|adc|sbc|and|ora|eor|jmp|jsr|ldx|ldy|stx|sty|bit)\s+>[^=]/i.exec(text);
  if (modifierMatch !== null) {
    const modifierIndex = />/.exec(modifierMatch[0]);
    if (modifierIndex !== null) {
      const index = modifierMatch.index + modifierIndex.index;
      return { text: ">", start: index, end: index + 1 };
    }
  }

  return null;
}

function getInvalidHexPayloadToken(node: ParsedLine): Token | null {
  if (node.shape !== "data" || node.directive.lexeme.toLowerCase() !== "hex") {
    return null;
  }

  let expectValue = true;
  let lastComma: Token | null = null;

  for (const token of node.tokens) {
    if (token.kind === "expressionOperator" && token.lexeme === ",") {
      if (expectValue) {
        return token;
      }
      expectValue = true;
      lastComma = token;
      continue;
    }

    if (/^[0-9A-Fa-f]+$/.test(token.lexeme) && token.lexeme.length % 2 === 0) {
      expectValue = false;
      lastComma = null;
      continue;
    }

    return token;
  }

  if (expectValue && lastComma !== null) {
    return lastComma;
  }

  return null;
}

function getOperandAddressingModes(
  mnemonic: string,
  forcesAbsolute: boolean,
  operand: Operand | null,
  values: ReadonlyMap<string, number>
): readonly AddressingMode[] {
  if (operand === null) {
    return ["implied"];
  }

  if (operand.immediate) {
    return ["immediate"];
  }

  if (operand.indirect) {
    if (operand.indexRegister === "x" && operand.indexPosition === "inside") {
      return ["indexedIndirect"];
    } else if (operand.indexRegister === "y" && operand.indexPosition === "outside") {
      return ["indirectIndexed"];
    } else if (operand.indexRegister === null) {
      return ["indirect"];
    }
    return [];
  }

  if (
    operand.expression.kind === "identifier" &&
    operand.expression.value.toLowerCase() === "a" &&
    (mnemonic === "asl" || mnemonic === "lsr" || mnemonic === "rol" || mnemonic === "ror")
  ) {
    return [];
  }

  const address = evaluateExpression(operand.expression, values);
  const isDirectPage = address !== null && address >= 0 && address <= 0xff;

  if (operand.indexRegister === "x") {
    if (forcesAbsolute) return ["absoluteX"];
    if (address === null) return ["zeroPageX", "absoluteX"];
    return isDirectPage ? ["zeroPageX"] : ["absoluteX"];
  }

  if (operand.indexRegister === "y") {
    if (forcesAbsolute) return ["absoluteY"];
    if (address === null) return ["zeroPageY", "absoluteY"];
    return isDirectPage ? ["zeroPageY"] : ["absoluteY"];
  }

  if (forcesAbsolute) return ["absolute"];
  if (address === null) return ["zeroPage", "absolute", "relative"];
  return isDirectPage ? ["zeroPage", "relative"] : ["absolute", "relative"];
}

export function collectAddressingModeDiagnostics(
  filePath: string,
  document: ParsedDocument,
  macroDefinitions: readonly MacroDefinitionRegion[],
  values: ReadonlyMap<string, number>
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const effectiveLines = getEffectiveLines(document, macroDefinitions);
  const assemblyEndLine = getDocumentAssemblyEndLine(document);

  for (const line of effectiveLines) {
    if (assemblyEndLine !== null && line.line > assemblyEndLine) {
      continue;
    }
    if (line.isExpanded || line.node.shape !== "instruction") {
      continue;
    }

    const mnemonic = normalizeMnemonic(line.node.mnemonic.lexeme);
    const definition = opcodeTable.get(mnemonic);
    if (definition === undefined) {
      continue;
    }

    const possibleModes = getOperandAddressingModes(
      mnemonic,
      line.node.mnemonic.lexeme.endsWith(":"),
      line.node.operand,
      values
    );
    const hasValidMode = possibleModes.some((mode) => definition.modes.includes(mode));

    if (!hasValidMode) {
      const lineLength = document.lines[line.line]?.node.text.length ?? 0;
      const range = resolveDiagnosticRange(false, line.node.mnemonic, lineLength);
      diagnostics.push({
        filePath,
        line: line.line,
        code: "invalid-addressing-mode",
        message: `Invalid addressing mode for '${mnemonic}'`,
        startCharacter: range?.start ?? line.node.mnemonic.start,
        endCharacter: range?.end ?? line.node.mnemonic.end
      });
    }
  }

  return diagnostics;
}
