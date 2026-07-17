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

  assert.deepEqual(scope.definitions.get("]loop@72"), {
    name: "]loop",
    line: 72,
    anchor: "GetKey",
    qualifiedName: "]loop@72"
  });

  assert.deepEqual(scope.references.get("]loop@74"), {
    name: "]loop",
    line: 74,
    anchor: "GetKey",
    qualifiedName: "]loop@72",
    targetLine: 72
  });

  assert.deepEqual(scope.definitions.get(":err@83"), {
    name: ":err",
    line: 83,
    anchor: "GetKey",
    qualifiedName: ":err@83"
  });

  assert.deepEqual(scope.references.get(":good@82"), {
    name: ":good",
    line: 82,
    anchor: "GetKey",
    qualifiedName: ":good@85",
    targetLine: 85
  });

  const colonDocument = parseDocument([
    "Host",
    ":loop   nop",
    "        bne :loop",
    ":loop   nop",
    "        bne :loop",
    "        jmp :loop"
  ].join("\n"));
  const colonScope = resolveLocalLabels(colonDocument);

  // bne :loop at line 2 targets :loop at line 1 (backward first)
  assert.deepEqual(colonScope.references.get(":loop@2"), {
    name: ":loop",
    line: 2,
    anchor: "Host",
    qualifiedName: ":loop@1",
    targetLine: 1
  });

  // bne :loop at line 4 targets :loop at line 3 (backward first)
  assert.deepEqual(colonScope.references.get(":loop@4"), {
    name: ":loop",
    line: 4,
    anchor: "Host",
    qualifiedName: ":loop@3",
    targetLine: 3
  });

  // jmp :loop at line 5 has no backward target after the latest :loop? Wait.
  // jmp :loop at line 5 targets :loop at line 3 (backward)
  assert.deepEqual(colonScope.references.get(":loop@5"), {
    name: ":loop",
    line: 5,
    anchor: "Host",
    qualifiedName: ":loop@3",
    targetLine: 3
  });

  const forwardFallbackDocument = parseDocument([
    "Host",
    "        bne :loop",
    ":loop   nop"
  ].join("\n"));
  const forwardFallbackScope = resolveLocalLabels(forwardFallbackDocument);

  assert.deepEqual(forwardFallbackScope.references.get(":loop@1"), {
    name: ":loop",
    line: 1,
    anchor: "Host",
    qualifiedName: ":loop@2",
    targetLine: 2
  });

  const macroDocument = parseDocument([
    "Wrap mac",
    "        ]loop lda ]1",
    "        bne ]loop",
    "        eom",
    "TargetA",
    "        Wrap TargetA",
    "TargetB",
    "        Wrap TargetB"
  ].join("\n"));
  const macroScope = resolveLocalLabels(macroDocument);

  assert.equal(macroScope.definitions.get("]loop@5"), undefined);
  assert.equal(macroScope.definitions.get("]loop@7"), undefined);
  assert.equal(macroScope.references.get("]loop@5:2"), undefined);
  assert.equal(macroScope.references.get("]loop@7:2"), undefined);

  const mixedScopeDocument = parseDocument([
    "HostLabel",
    "        ]loop nop",
    "Wrap mac",
    "        ]loop lda ]1",
    "        bne ]loop",
    "        eom",
    "TargetC",
    "        Wrap TargetC",
    "        bne ]loop"
  ].join("\n"));
  const mixedScope = resolveLocalLabels(mixedScopeDocument);

  assert.deepEqual(mixedScope.definitions.get("]loop@1"), {
    name: "]loop",
    line: 1,
    anchor: "HostLabel",
    qualifiedName: "]loop@1"
  });

  assert.equal(mixedScope.definitions.get("]loop@7"), undefined);
  assert.equal(mixedScope.references.get("]loop@8"), undefined);
}
