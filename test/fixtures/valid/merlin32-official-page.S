; Source: apple2accumulator/merlin32
; Official page transcription: current address, brace precedence, variables,
; semicolon macro parameters, ]0, nested macro definitions, implicit include suffixes.

        org $800
Base    nop
Size    = *

LeftRight = 1+2*3
Braced    = {1+2*3}

]counter = 0
]counter = ]counter + 1
        lda ]counter

Move mac
        lda ]1
        sta ]2
        eom
        Move #$00;$02

ArgCount mac
        dfb ]0
        eom
        ArgCount
        ArgCount VALUE

OuterMac mac
InnerMac mac
        nop
        <<<
        nop
        <<<
        OuterMac

        use 4/Int.Macs

VALUE   = $20
