; Source: apple2accumulator/merlin32
; Upstream file: Test/main.s
; Unknown diagnostic coverage: long-addressing and bank-byte modifiers.

        xc
        xc
        org $018200

dp      equ $A5
long    equ $020304

        lda dp
        lda <dp
        lda >dp
        lda ^dp
        lda |dp

        lda #long
        lda #<long
        lda #>long
        lda #^long

        lda long
        lda <long
        lda >long
        lda ^long
