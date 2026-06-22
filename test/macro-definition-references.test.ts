import assert from "node:assert/strict";

import { buildCachedDocument } from "../src/asm/document";
import { collectReferences, findDefinition } from "../src/lsp/symbol-navigation";

export function runMacroDefinitionReferencesIntegrationTest(): void {
  const cached = buildCachedDocument([
    "Inner mac",
    "        lda ]1",
    "        eom",
    "Outer mac",
    "        Inner ]1",
    "        sta ]1",
    "        eom",
    "Target   equ 1",
    "        Outer Target"
  ].join("\n"));

  const references = collectReferences("file:///macro-nested.S", cached);
  const targetReferences = references.filter((reference) => reference.name === "Target");
  assert.deepEqual(targetReferences, [
    {
      name: "Target",
      location: {
        uri: "file:///macro-nested.S",
        range: {
          start: { line: 8, character: 14 },
          end: { line: 8, character: 20 }
        }
      }
    }
  ]);

  const definition = findDefinition(
    new Map([["file:///macro-nested.S", cached]]),
    "file:///macro-nested.S",
    8,
    15
  );
  assert.deepEqual(definition, {
    uri: "file:///macro-nested.S",
    range: {
      start: { line: 7, character: 0 },
      end: { line: 7, character: 6 }
    }
  });

  const innerDef = findDefinition(
    new Map([["file:///macro-nested.S", cached]]),
    "file:///macro-nested.S",
    1,
    12
  );
  assert.deepEqual(innerDef, {
    uri: "file:///macro-nested.S",
    range: {
      start: { line: 7, character: 0 },
      end: { line: 7, character: 6 }
    }
  });

  const outerDef = findDefinition(
    new Map([["file:///macro-nested.S", cached]]),
    "file:///macro-nested.S",
    4,
    14
  );
  assert.deepEqual(outerDef, {
    uri: "file:///macro-nested.S",
    range: {
      start: { line: 7, character: 0 },
      end: { line: 7, character: 6 }
    }
  });
}
