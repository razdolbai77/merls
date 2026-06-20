import assert from "node:assert/strict";
import { buildCachedDocument } from "../src/asm/document";
import { formatDocument } from "../src/lsp/formatting";

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
}

