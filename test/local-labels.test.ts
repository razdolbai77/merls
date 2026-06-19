import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { parseDocument } from "../src/asm/document";
import { resolveLocalLabels } from "../src/asm/local-labels";

export function runLocalLabelScopeTest(): void {
  const fixturePath = path.resolve(
    process.cwd(),
    "test/fixtures/valid/merlin32-main-6502.S"
  );
  const source = fs.readFileSync(fixturePath, "utf8");

  const document = parseDocument(source);
  const scope = resolveLocalLabels(document);

  assert.deepEqual(scope.definitions.get("]loop@69"), {
    name: "]loop",
    line: 71,
    anchor: "GetKey",
    qualifiedName: "]loop@69"
  });

  assert.deepEqual(scope.references.get("]loop@73"), {
    name: "]loop",
    line: 73,
    anchor: "GetKey",
    qualifiedName: "]loop@69",
    targetLine: 71
  });

  assert.deepEqual(scope.definitions.get(":err@69"), {
    name: ":err",
    line: 82,
    anchor: "GetKey",
    qualifiedName: ":err@69"
  });

  assert.deepEqual(scope.references.get(":good@81"), {
    name: ":good",
    line: 81,
    anchor: "GetKey",
    qualifiedName: ":good@69",
    targetLine: 84
  });
}
