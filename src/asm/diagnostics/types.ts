import { type ParsedDocument } from "../document";
import { type Token } from "../lexer";
import { getCallSiteToken } from "../expansion";
import { macroParameterPattern } from "../macros";

export type DiagnosticCode =
  | "duplicate-symbol"
  | "duplicate-macro-definition"
  | "unresolved-reference"
  | "malformed-line"
  | "unknown-directive"
  | "unsupported-instruction"
  | "unknown-syntax"
  | "missing-macro-end"
  | "macro-arity-mismatch"
  | "macro-recursion"
  | "deep-macro-expansion"
  | "token-pasted-name"
  | "unresolved-conditional"
  | "invalid-macro-local-label"
  | "forward-macro-call"
  | "forward-equate-reference"
  | "invalid-addressing-mode"
  | "unterminated-loop"
  | "unmatched-loop-terminator"
  | "unsupported-generated-label"
  | "invalid-data-operand";

export type Diagnostic = {
  filePath: string;
  line: number;
  code: DiagnosticCode;
  message: string;
  startCharacter?: number;
  endCharacter?: number;
};

export function createMacroTokenDiagnostic(
  filePath: string,
  line: number,
  token: Token,
  code: DiagnosticCode,
  message: string
): Diagnostic {
  return {
    filePath,
    line,
    code,
    message,
    startCharacter: token.start,
    endCharacter: token.end
  };
}

export function addTokenPastedNameDiagnostic(
  diagnostics: Diagnostic[],
  filePath: string,
  line: number,
  token: Token,
  nameKind = "name"
): void {
  if (!macroParameterPattern.test(token.lexeme) && /\]\d+/.test(token.lexeme)) {
    diagnostics.push(
      createMacroTokenDiagnostic(
        filePath,
        line,
        token,
        "token-pasted-name",
        `Unsupported token-pasted ${nameKind} ${token.lexeme}`
      )
    );
  }
}

export function addInvalidMacroLocalLabelDiagnostic(
  diagnostics: Diagnostic[],
  filePath: string,
  line: number,
  token: Token
): void {
  diagnostics.push(
    createMacroTokenDiagnostic(
      filePath,
      line,
      token,
      "invalid-macro-local-label",
      `Local labels (${token.lexeme}) cannot be used inside macros.`
    )
  );
}

export type DocumentEntry = {
  filePath: string;
  document: ParsedDocument;
};

export type SymbolRecord = {
  name: string;
  line: number;
  filePath: string;
  startCharacter: number;
  endCharacter: number;
};

export type MacroRecord = {
  name: string;
  line: number;
  filePath: string;
  startCharacter: number;
  endCharacter: number;
  maxParameterIndex: number;
  usesArgumentCountParameter: boolean;
  documentIndex: number;
};

export type EquateRecord = {
  name: string;
  line: number;
  documentIndex: number;
};

export function resolveDiagnosticRange(
  isExpanded: boolean,
  token: Token,
  lineLength: number
): { start: number; end: number } | null {
  let rangeToken: Token = token;

  if (isExpanded) {
    const callSiteToken = getCallSiteToken(token, isExpanded);
    if (callSiteToken === null || callSiteToken === undefined) {
      return null;
    }
    rangeToken = callSiteToken;
  }

  const start = Math.max(0, Math.min(rangeToken.start, lineLength));
  const end = Math.max(start, Math.min(rangeToken.end, lineLength));
  return { start, end };
}
