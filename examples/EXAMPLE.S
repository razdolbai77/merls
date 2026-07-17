* @razdolbai/merls - Feature Showcase & Diagnostic Examples
* This file demonstrates the supported 6502/Merlin32 syntax
* and the diagnostics provided by the language server.

        ORG     $1000

* ==========================================
* Positive Features: Valid Syntax
* ==========================================

* Equates and Variables
TargetValue EQU $C000
Counter =       0

* Macro Definition with Parameters and Macro Variables
WaitLoop MAC
        LDX     ]1      ; ]1 is the first positional parameter
        EOM

AnotherMacro MAC
        LDY     ]1      ; ]1 is the first positional parameter
        LDX     ]2      ; ]2 is the second positional parameter
        <<<

* Instruction Parsing and Addressing Modes
StartRoutine
        CLC
        ADC     #10     ; Immediate
        LSR     A       ; Accumulator
        LDA     TargetValue ; Absolute
        STA     $00,X   ; Zero Page Indexed
        STA     $00,Y   ; Zero Page Indexed
        JMP     (TargetValue) ; Indirect

* Data Directives
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
        INV     'foobar'
        INV     "foobar"
        FLS     'foobar'
        FLS     "foobar"
        STR     'foobar'
        STR     "foobar"
        STRL    'foobar'
        STRL    "foobar"
        DA      StartRoutine
        DS      10      ; Define storage

* Macro Calls
        WaitLoop #$FF
        WaitLoop #10

* Ordinary Local Labels
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

* ==========================================
* Diagnostics: Invalid Syntax & Errors
* ==========================================

* Diagnostic: Duplicate Symbol Definition
StartRoutine            ; Error: Duplicate symbol 'StartRoutine'
        NOP

* Diagnostic: Unresolved Reference
        LDA     MissingValue ; Error: Unresolved reference 'MissingValue'

* Diagnostic: "]"-labels should be defined before they are used
        BNE     ]forward
]forward

* Diagnostic: ":"-labels are limited to the scope between nearby global labels
:outside
        NOP
global1
        BNE     :outside
global2

* Diagnostic: Duplicate Macro Definition
AnotherMacro MAC        ; Error: Duplicate macro 'AnotherMacro'
        LDX     ]1
        <<<

WaitLoop MAC            ; Error: Duplicate macro 'WaitLoop'
        DEX
        RTS
        EOM

* Diagnostic: Invalid Local Label in Macro
BadLocalLabel MAC
:loop                   ; Error: Local labels (:) cannot be used inside macros
]local
        EOM

* Diagnostic: Missing Macro Terminator
BadMacro MAC            ; Error: Missing eom/<<< terminator
        LDA     #0
* (No eom here)

* Case sensitivity
        BNE     startRoutine ; Error: Unresolved reference 'startRoutine' (case-sensitive)
        waitLoop #$FF   ; Error: Unresolved reference 'waitLoop' (case-sensitive)


* Diagnostic: Unknown Syntax
        LDA     >$12345 ; Error: Unknown syntax: >
        rep     #$20    ; Error: Unsupported instruction or undefined macro: rep
        pea     $0000   ; Error: Unsupported instruction or undefined macro: pea
        blah            ; Error: Unsupported instruction or undefined macro: blah

* Diagnostic: Valid instruction, incorrect addressing mode
        LDA     a
        DEX     #10     ; Error: Invalid addressing mode for 'dex'
        CLC     $1000   ; Error: Invalid addressing mode for 'clc'
        JMP     #$1000  ; Error: Invalid addressing mode for 'jmp'
        STA     #10     ; Error: Invalid addressing mode for 'sta'

* Diagnostic: Incorrect index register placement in indirect addressing
        LDA     ($10),X ; Error: Invalid addressing mode for 'lda'
        STA     ($10,Y) ; Error: Invalid addressing mode for 'sta'
