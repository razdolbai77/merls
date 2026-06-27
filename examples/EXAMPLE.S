* @razdolbai/merls - Feature Showcase & Diagnostic Examples
* This file demonstrates the supported 6502/Merlin32 syntax
* and the diagnostics provided by the language server.

        org     $1000

* ==========================================
* Positive Features: Valid Syntax
* ==========================================

* Equates and Variables
TargetValue equ $C000
Counter =       0

* Macro Definition with Parameters and Macro Variables
WaitLoop mac
        ldx     ]1      ; ]1 is the first positional parameter
]local                  ; macro variable used as a label
        dex
        bne     ]local
        eom

* Instruction Parsing and Addressing Modes
StartRoutine
        clc
        adc     #10     ; Immediate
        lda     TargetValue ; Absolute
        sta     $00,x   ; Zero Page Indexed
        jmp     (TargetValue) ; Indirect

* Data Directives
        hex     000102
        dfb     %001
        db      $03,$04
        ddb     $000a
        da      $55
        dw      $1000,$2000
        asc     'foobar'
        asc     "foobar"
        dci     "foobar"
        dci     'foobar'
        inv     'foobar'
        inv     "foobar"
        fls     'foobar'
        fls     "foobar"
        str     'foobar'
        str     "foobar"
        strl    'foobar'
        strl    "foobar"
        da      StartRoutine
        ds      10,$FF  ; Define storage

* Macro Calls
        WaitLoop #$FF
        WaitLoop #10

* Ordinary Local Labels
Subroutine
        ldy     #5
:loop                   ; ordinary local label
        dey
        bne     :loop
]local
        dey
        bne     ]local
        rts

* ==========================================
* Diagnostics: Invalid Syntax & Errors
* ==========================================

* Diagnostic: Duplicate Symbol Definition
StartRoutine            ; Error: Duplicate symbol 'StartRoutine'
        nop

* Diagnostic: Unresolved Reference
        lda     MissingValue ; Error: Unresolved reference 'MissingValue'

* Diagnostic: Duplicate Macro Definition
WaitLoop mac            ; Error: Duplicate macro 'WaitLoop'
        rts
        eom

* Diagnostic: Invalid Local Label in Macro
BadLocalLabel mac
:loop                   ; Error: Local labels (:) cannot be used inside macros
]local
        eom

* Diagnostic: Missing Macro Terminator
BadMacro mac            ; Error: Missing eom/<<< terminator
        lda     #0
* (No eom here)

* Case sensitivity
        bne     startRoutine ; Error: Unresolved reference 'startRoutine' (case-sensitive)
        waitLoop #$FF   ; Error: Unresolved reference 'waitLoop' (case-sensitive)


* Diagnostic: Unknown Syntax
        lda     >$12345 ; Error: Unknown syntax: >
        rep     #$20    ; Error: Unsupported instruction or undefined macro: rep
        pea     $0000   ; Error: Unsupported instruction or undefined macro: pea
        blah            ; Error: Unsupported instruction or undefined macro: blah
