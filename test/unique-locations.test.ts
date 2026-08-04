import assert from "node:assert/strict";
import { type Location } from "vscode-languageserver/node";

import { uniqueLocations } from "../src/lsp/symbol-navigation";

export function runUniqueLocationsTest(): void {
  const first: Location = {
    uri: "file:///a.S",
    range: {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 6 }
    }
  };
  const duplicate: Location = {
    uri: "file:///a.S",
    range: {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 6 }
    }
  };
  const second: Location = {
    uri: "file:///b.S",
    range: {
      start: { line: 4, character: 2 },
      end: { line: 4, character: 8 }
    }
  };

  assert.deepEqual(uniqueLocations([first, duplicate, second]), [first, second]);
  assert.deepEqual(uniqueLocations([]), []);
  // Order of first occurrence is preserved, not insertion order of duplicates.
  assert.deepEqual(uniqueLocations([duplicate, first]), [duplicate]);
}
