; Source: apple2accumulator/merlin32
; Upstream file: Test/linkscript.s
; Transcribed for a 6502-only positive fixture corpus.

*  linkscript.s
*  Merlin32 Test
*
*  Created by Lane Roathe on 8/21/19.

    typ $06

    dsk Merlin32Test
    org $800

    asm "merlin32-main-6502.asm"
    sna main
