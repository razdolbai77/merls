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

  assert.deepEqual(scope.definitions.get("]loop@70"), {
    name: "]loop",
    line: 72,
    anchor: "GetKey",
    qualifiedName: "]loop@70"
  });

  assert.deepEqual(scope.references.get("]loop@74"), {
    name: "]loop",
    line: 74,
    anchor: "GetKey",
    qualifiedName: "]loop@70",
    targetLine: 72
  });

  assert.deepEqual(scope.definitions.get(":err@70"), {
    name: ":err",
    line: 83,
    anchor: "GetKey",
    qualifiedName: ":err@70"
  });

  assert.deepEqual(scope.references.get(":good@82"), {
    name: ":good",
    line: 82,
    anchor: "GetKey",
    qualifiedName: ":good@70",
    targetLine: 85
  });
}
