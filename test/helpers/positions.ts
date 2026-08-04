import assert from "node:assert/strict";

export type TextPosition = {
  line: number;
  character: number;
};

export function positionOf(text: string, needle: string): TextPosition {
  const index = text.indexOf(needle);
  assert.notEqual(index, -1, `expected to find ${needle}`);
  const prefix = text.slice(0, index);
  const lines = prefix.split("\n");
  return {
    line: lines.length - 1,
    character: lines.at(-1)?.length ?? 0
  };
}

export function positionOfLast(text: string, needle: string): TextPosition {
  const index = text.lastIndexOf(needle);
  assert.notEqual(index, -1, `expected to find last ${needle}`);
  const prefix = text.slice(0, index);
  const lines = prefix.split("\n");
  return {
    line: lines.length - 1,
    character: lines.at(-1)?.length ?? 0
  };
}

export function positionOfInMatch(text: string, needle: string, offset: number): TextPosition {
  const base = positionOf(text, needle);
  return {
    line: base.line,
    character: base.character + offset
  };
}
