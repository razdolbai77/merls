; Source: apple2accumulator/merlin32
; Upstream file: Test/main.s
; Transcribed from the 6502-safe portion and trimmed to exclude 65816-only cases.

*  main.s
*  Merlin32 Test
*
*  Created by Lane Roathe on 8/26/19.

]XCODESTART

TEXT    =   $FB39
CROUT   =   $FD8E
DOSWARM =   $3D0
TSTADDR =   $1000

        DUM 0
dum0    ds  1
dum1    ds  1
dumSize =   *
        DEND

        DUM 0
_ptr    ds  2
_tmp    ds  2
_num1   ds  dumSize

        ORG $20
_LFT    ds  1
        DEND

TEST_START
        adc (0,x)
        adc ($80,x)
        adc (_tmp,x)
        adc (_tmp+0,x)
        adc (_tmp+$10,x)
        adc ($10+_tmp,x)
        adc (_tmp+dum0,x)
        adc (_tmp+dum1,x)
        adc (_tmp+dum1+1,x)
        adc (_tmp+dum0+dum1,x)

        adc 0
        adc $80
        adc _tmp
        adc #0
        adc $1111

        sta TSTADDR+dum0
        sta TSTADDR+_num1+dum0
        sta TSTADDR+_num1+dum0,x

        lda _num1+dum0
        adc _num1+dum1
        sbc _num1+dum1
        bit _num1+dum0
        sta _num1+dum0

        lda _num1+dum0,x
        adc _num1+dum0,x
        sbc _num1+dum0,x
        sta _num1+dum0,x

        lda _num1+dum0,y
        adc _num1+dum0,y
        sbc _num1+dum0,y
        sta _num1+dum0,y

GetKey  ldx $C000
        bpl GetKey
]loop
        dex
        bne ]loop

        tya
        and #1
        beq :err

        tya
        and #1
        bne :good
:err
        lda #0
:good
        bne myQuit
        nop
        hex 2C
        lda #1
myQuit
        jmp DOSWARM

        org $2000

        lda _LFT
        ldx #_LFT
        cpx #$20

        org

        stx $bc,y

]XCODEEND
