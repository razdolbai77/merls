* @razdolbai/merls - Feature Showcase
* A diagnostics-free starter file demonstrating supported 6502/Merlin32 syntax.
* For intentionally invalid syntax and its diagnostics, open DIAGNOSTICS.S.

        ORG     $1000

* ==========================================
* Equates, Variables, and Labels
* ==========================================

TargetValue EQU $C000
Counter =       0

* Current address and precedence
LeftRight EQU 1+2*3             ; left-to-right: (1+2)*3 = 9
Braced    EQU {1+2*3}           ; braced algebraic: 1+2*3 = 7
CodeSize  = *                   ; current address
]counter  = 0                   ; Merlin variables are reassignable
]counter  = ]counter + 1

* ==========================================
* Macro Definitions
* ==========================================

WaitLoop MAC
        LDX     ]1      ; ]1 is the first positional parameter
        EOM

AnotherMacro MAC
        LDY     ]1      ; ]1 is the first positional parameter
        LDX     ]2      ; ]2 is the second positional parameter
        <<<

Move MAC
        LDA     ]1
        STA     ]2
        EOM

ArgCount MAC
        DFB     ]0      ; ]0 expands to the supplied argument count
        EOM

* ==========================================
* Instructions and Addressing Modes
* ==========================================

StartRoutine
        CLC
        ADC     #10     ; Immediate
        LSR             ; Implied accumulator
        LDA     TargetValue ; Absolute
        STA     $00,X   ; Zero Page Indexed
        STX     $00,Y   ; Zero Page Indexed (Y)
        JMP     (TargetValue) ; Indirect

* ==========================================
* Data Directives
* ==========================================

        HEX     000102
        HEX     00,ff
        LDA     $ff
        DFB     %001
        DB      $03,$04
        DDB     $000a
        DA      $55
        DW      $1000,$2000
        ASC     'foobar'
        ASC     "foobar"
        DCI     "foobar"
        DCI     'foobar'
        INV     'FOOBAR'
        INV     "FOOBAR"
        FLS     'FOOBAR'
        FLS     "FOOBAR"
        STR     'foobar'
        STR     "foobar"
        STRL    'foobar'
        STRL    "foobar"
        DA      StartRoutine
        DS      10      ; Define storage

* ==========================================
* Macro Calls
* ==========================================

        WaitLoop #$FF
        WaitLoop #10
        Move #$00;$02   ; semicolon-separated macro parameters
        ArgCount        ; ]0 reports 0 arguments
        ArgCount TargetValue ; ]0 reports 1 argument

* ==========================================
* Ordinary Local Labels
* ==========================================

Subroutine
        LDY     #5
b
        NOP
:loop                   ; ordinary local label
        DEY
        BNE     :loop
        NOP
c
]local
        DEY
        BNE     ]local
        RTS
