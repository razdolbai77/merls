import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import path from "node:path";

import { buildCachedDocument } from "../src/asm/document";
import { indexWorkspace } from "../src/asm/workspace";
import { collectWorkspaceDiagnostics } from "../src/asm/diagnostics";

export function runPerformanceTest(): void {
  const lines: string[] = [];

  // Define 50 macros
  for (let i = 0; i < 50; i++) {
    lines.push(`Macro${i} mac`);
    lines.push(`        lda ]1`);
    lines.push(`        sta ]2`);
    lines.push(`        eom`);
  }

  // Define some labels and macro calls
  for (let i = 0; i < 10000; i++) {
    lines.push(`Label${i}`);
    const macroIndex = i % 50;
    lines.push(`        Macro${macroIndex} #$00, Label${i}`);
  }

  const source = lines.join("\n");

  const start = performance.now();
  
  const document = buildCachedDocument(source);
  
  const fixturePath = path.resolve("<performance-fixture>");
  const overrides = new Map([
    [fixturePath, document]
  ]);

  const workspace = indexWorkspace(fixturePath, new Map(), overrides);
  
  const diagnostics = collectWorkspaceDiagnostics([
    {
      filePath: fixturePath,
      document: document.parsed
    }
  ]);

  const duration = performance.now() - start;

  assert.ok(duration < 5000, `Performance test took too long: ${duration}ms`);
  assert.ok(workspace.macros.size === 50, `Expected 50 macros, got ${workspace.macros.size}`);
  assert.ok(workspace.symbols.size >= 10000, `Expected >= 10000 symbols, got ${workspace.symbols.size}`);
  assert.ok(diagnostics.length >= 0, "Evaluated diagnostics");
}
