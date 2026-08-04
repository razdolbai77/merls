; Source: apple2accumulator/merlin32
; Macro fixture coverage for definitions, nested calls, zero-arg forms,
; semicolon-separated arguments, local labels, and conditional assembly.

EmitByte mac
        lda ]1
        sta $2000
        eom

NoArgs  mac
        clc
        adc #1
        eom

PrintPair mac
        lda ]1
        ldx ]2
        eom

Outer   mac
        EmitByte ]2
        NoArgs
        PrintPair #',';]1
        ldx ]3
        eom

VALUE   = $20
TARGET  = $40
Start   Outer VALUE;1;TARGET
Done
]done   rts
        do 1
        nop
        fin
