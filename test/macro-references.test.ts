import assert from "node:assert/strict";

import { buildCachedDocument } from "../src/asm/document";
import { collectReferences, findDefinition } from "../src/lsp/symbol-navigation";

export function runMacroReferencesTest(): void {
  const cached = buildCachedDocument([
    "UseTwice mac",
    "        lda ]1",
    "        sta ]1",
    "        adc ]2",
    "        eom",
    "Target   equ 1",
    "Offset   equ 2",
    "Other    equ 3",
    "        UseTwice Target+Offset;Other"
  ].join("\n"));

  const references = collectReferences("file:///macro-test.S", cached);

  assert.deepEqual(
    references.filter((reference) => reference.name === "Target"),
    [
      {
        name: "Target",
        location: {
          uri: "file:///macro-test.S",
          range: {
            start: { line: 8, character: 17 },
            end: { line: 8, character: 23 }
          }
        }
      }
    ]
  );

  assert.deepEqual(
    references.filter((reference) => reference.name === "Offset"),
    [
      {
        name: "Offset",
        location: {
          uri: "file:///macro-test.S",
          range: {
            start: { line: 8, character: 24 },
            end: { line: 8, character: 30 }
          }
        }
      }
    ]
  );

  assert.deepEqual(
    references.filter((reference) => reference.name === "Other"),
    [
      {
        name: "Other",
        location: {
          uri: "file:///macro-test.S",
          range: {
            start: { line: 8, character: 31 },
            end: { line: 8, character: 36 }
          }
        }
      }
    ]
  );

  const definition = findDefinition(
    new Map([["file:///macro-test.S", cached]]),
    "file:///macro-test.S",
    8,
    18
  );
  assert.deepEqual(definition, {
    uri: "file:///macro-test.S",
    range: {
      start: { line: 5, character: 0 },
      end: { line: 5, character: 6 }
    }
  });
}
