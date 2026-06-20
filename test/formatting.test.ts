import assert from "node:assert/strict";
import { buildCachedDocument } from "../src/asm/document";
import { formatDocument, formatRange, formatOnType } from "../src/lsp/formatting";

export function runFormattingTest(): void {
  // aligns instruction fields using spaces
  {
    const source = "label  adc  (0,x) ; comment\n  sta _num1+dum0,x";
    const cached = buildCachedDocument(source);
    const edits = formatDocument(cached, { insertSpaces: true, tabSize: 8 });

    assert.equal(edits.length, 2);
    assert.equal(edits[0].newText, "label   adc     (0,x)   ; comment");
    assert.equal(edits[1].newText, "        sta     _num1+dum0,x");
  }

  // handles labels without operands
  {
    const source = "myQuit\n        rts";
    const cached = buildCachedDocument(source);
    const edits = formatDocument(cached, { insertSpaces: true, tabSize: 8 });

    assert.equal(edits.length, 0);
  }

  // formats equates
  {
    const source = "TEXT = $FB39\nMY_VAL EQU $42";
    const cached = buildCachedDocument(source);
    const edits = formatDocument(cached, { insertSpaces: true, tabSize: 8 });

    assert.equal(edits.length, 2);
    assert.equal(edits[0].newText, "TEXT    =       $FB39");
    assert.equal(edits[1].newText, "MY_VAL  EQU     $42");
  }

  // handles long labels
  {
    const source = "veryLongLabel adc #0";
    const cached = buildCachedDocument(source);
    const edits = formatDocument(cached, { insertSpaces: true, tabSize: 8 });

    assert.equal(edits.length, 0);
  }

  // handles malformed lines safely
  {
    const source = "label adc #0\noops malformed\nlabel2 rts";
    const cached = buildCachedDocument(source);
    const edits = formatDocument(cached, { insertSpaces: true, tabSize: 8 });

    assert.equal(edits.length, 2);
    assert.equal(edits[0].newText, "label   adc     #0");
    assert.equal(edits[1].newText, "label2  rts");
  }

  // formats specific range
  {
    const source = "label1 adc #1\nlabel2 adc #2\nlabel3 adc #3";
    const cached = buildCachedDocument(source);
    const edits = formatRange(cached, { insertSpaces: true, tabSize: 8 }, {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 10 }
    });

    assert.equal(edits.length, 1);
    assert.equal(edits[0].newText, "label2  adc     #2");
  }

  // formats on type enter
  {
    const source = "label1 adc #1\n";
    const cached = buildCachedDocument(source);
    // User typed enter at the end of line 0, so position is line 1, character 0
    const edits = formatOnType(cached, { insertSpaces: true, tabSize: 8 }, { line: 1, character: 0 }, "\n");

    assert.equal(edits.length, 1);
    assert.equal(edits[0].newText, "label1  adc     #1");
  }
}
