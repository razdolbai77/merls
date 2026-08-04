import assert from "node:assert/strict";
import { renderMacroParameters } from "../src/lsp/macro-signature";

export function runMacroSignatureTest(): void {
  assert.deepEqual(renderMacroParameters(0), []);
  assert.deepEqual(renderMacroParameters(2), ["]1", "]2"]);
  assert.deepEqual(renderMacroParameters(2, 4), ["]1", "]2", "]3", "]4"]);
}
