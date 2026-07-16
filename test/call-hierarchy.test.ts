import assert from "node:assert/strict";
import { buildCachedDocument } from "../src/asm/document";
import { prepareCallHierarchy, provideCallHierarchyIncomingCalls, provideCallHierarchyOutgoingCalls } from "../src/lsp/call-hierarchy";

export function runCallHierarchyTest(): void {
  const source = `
foo
  jsr bar
  jmp baz
  rts

bar
  nop
  rts

baz
  jsr foo
  rts
  `;

  const cached = buildCachedDocument(source);
  const map = new Map([["file:///test.S", cached]]);
  
  // prepare
  const prepared = prepareCallHierarchy(map, "file:///test.S", 2, 7); // "  jsr bar"
  assert.ok(prepared);
  assert.equal(prepared.length, 1);
  assert.equal(prepared[0].name, "bar");

  // incoming
  const incoming = provideCallHierarchyIncomingCalls(map, prepared[0]);
  assert.ok(incoming);
  assert.equal(incoming.length, 1);
  assert.equal(incoming[0].from.name, "foo");
  assert.deepEqual(incoming[0].from.range, {
    start: { line: 1, character: 0 },
    end: { line: 1, character: 3 }
  });

  // outgoing from foo
  const preparedFoo = prepareCallHierarchy(map, "file:///test.S", 1, 0); // "foo"
  assert.ok(preparedFoo);
  const outgoingFoo = provideCallHierarchyOutgoingCalls(map, preparedFoo[0]);
  assert.ok(outgoingFoo);
  assert.equal(outgoingFoo.length, 2);
  assert.equal(outgoingFoo[0].to.name, "bar");
  assert.equal(outgoingFoo[1].to.name, "baz");

  // outgoing from baz
  const preparedBaz = prepareCallHierarchy(map, "file:///test.S", 10, 0); // "baz"
  assert.ok(preparedBaz);
  const outgoingBaz = provideCallHierarchyOutgoingCalls(map, preparedBaz[0]);
  assert.ok(outgoingBaz);
  assert.equal(outgoingBaz.length, 1);
  assert.equal(outgoingBaz[0].to.name, "foo");
}
