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
    assert.equal(edits[0].newText, "label   ADC     (0,X)   ; comment");
    assert.equal(edits[1].newText, "        STA     _num1+dum0,X");
  }

  // handles labels without operands
  {
    const source = "myQuit\n        rts";
    const cached = buildCachedDocument(source);
    const edits = formatDocument(cached, { insertSpaces: true, tabSize: 8 });

    assert.equal(edits.length, 1);
    assert.equal(edits[0].newText, "        RTS");
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

  // formats known directives to uppercase
  {
    const source = "        hex 00,01,02,03";
    const cached = buildCachedDocument(source);
    const edits = formatDocument(cached, { insertSpaces: true, tabSize: 8 });

    assert.equal(edits.length, 1);
    assert.equal(edits[0].newText, "        HEX     00,01,02,03");
  }

  // handles long labels
  {
    const source = "veryLongLabel adc #0";
    const cached = buildCachedDocument(source);
    const edits = formatDocument(cached, { insertSpaces: true, tabSize: 8 });

    assert.equal(edits.length, 1);
    assert.equal(edits[0].newText, "veryLongLabel ADC #0");
  }

  // handles malformed lines safely
  {
    const source = "label adc #0\n equ $12\nlabel2 rts";
    const cached = buildCachedDocument(source);
    const edits = formatDocument(cached, { insertSpaces: true, tabSize: 8 });

    assert.equal(edits.length, 2);
    assert.equal(edits[0].newText, "label   ADC     #0");
    assert.equal(edits[1].newText, "label2  RTS");
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
    assert.equal(edits[0].newText, "label2  ADC     #2");
  }

  // formats on type enter
  {
    const source = "label1 adc #1\n";
    const cached = buildCachedDocument(source);
    // User typed enter at the end of line 0, so position is line 1, character 0
    const edits = formatOnType(cached, { insertSpaces: true, tabSize: 8 }, { line: 1, character: 0 }, "\n");

    assert.equal(edits.length, 1);
    assert.equal(edits[0].newText, "label1  ADC     #1");
  }

  // formats with tabs (tabSize: 8)
  {
    const source = "label adc #0 ; comment\n sta _num1+dum0,x";
    const cached = buildCachedDocument(source);
    const edits = formatDocument(cached, { insertSpaces: false, tabSize: 8 });

    assert.equal(edits.length, 2);
    assert.equal(edits[0].newText, "label\tADC\t#0\t; comment");
    assert.equal(edits[1].newText, "\tSTA\t_num1+dum0,X");
  }

  // formats with tabs (tabSize: 4)
  {
    const source = "label adc #0 ; comment";
    const cached = buildCachedDocument(source);
    const edits = formatDocument(cached, { insertSpaces: false, tabSize: 4 });

    assert.equal(edits.length, 1);
    // label (5) + 1 tab -> 8
    // ADC (3) -> total 11 + 2 tabs (to 16) -> \t\t
    // #0 (2) -> total 18 + 2 tabs (to 24) -> \t\t
    assert.equal(edits[0].newText, "label\tADC\t\t#0\t\t; comment");
  }
}
