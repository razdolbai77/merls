; Source: apple2accumulator/merlin32
; Macro fixture coverage for definitions, nested calls, zero-arg forms,
; comma-heavy arguments, local labels, and conditional assembly.

EmitByte mac
        lda ]1
        sta $2000
        eom

NoArgs  mac
        clc
        adc #1
        eom

PrintPair mac
        PrintPair #',' , ]1
        lda ]1
        ldx ]2
]done   rts
        eom

Outer   mac
        EmitByte ]1
        NoArgs
        do ]2
        PrintPair ]1, ]3
        fin
        eom

Start   Outer VALUE,1,TARGET
VALUE   = $20
TARGET  = $40
