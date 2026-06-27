; Source: apple2accumulator/merlin32
; Upstream file: Test/main.s
; Unknown diagnostic coverage: block move, width control, and stack-address forms.

        xc
        xc
        org $018200

bank02  equ $020000
bank03  equ $030000

        mx %00
start   nop
        pea ^start
        pea start
        mvn bank02,bank03
        mvp bank03,bank02
