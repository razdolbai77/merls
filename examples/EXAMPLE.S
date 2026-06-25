* @razdolbai/merls - Feature Showcase & Diagnostic Examples
* This file demonstrates the supported 6502/Merlin32 syntax
* and the diagnostics provided by the language server.

    org $1000

* ==========================================
* Positive Features: Valid Syntax
* ==========================================

* Equates and Variables
TargetValue equ $C000
Counter     =   0

* Macro Definition with Parameters and Local Labels
    mac WaitLoop
    ldx ]1          ; ]1 is the first positional parameter
]local              ; macro-local label
    dex
    bne ]local
    eom

* Instruction Parsing and Addressing Modes
StartRoutine
    clc
    adc #10         ; Immediate
    lda TargetValue ; Absolute
    sta $00,x       ; Zero Page Indexed
    jmp (TargetValue) ; Indirect

* Data Directives
    hex 00 01 02
    db  $03, $04
    dw  $1000, $2000
    da  StartRoutine
    ds  10, $FF     ; Define storage

* Macro Calls
    WaitLoop #$FF
    WaitLoop #10

* Ordinary Local Labels
Subroutine
    ldy #5
:loop               ; ordinary local label
    dey
    bne :loop
    rts

* ==========================================
* Diagnostics: Invalid Syntax & Errors
* ==========================================

* Diagnostic: Duplicate Symbol Definition
StartRoutine        ; Error: Duplicate symbol 'StartRoutine'
    nop

* Diagnostic: Unresolved Reference
    lda MissingValue ; Error: Unresolved symbol 'MissingValue'

* Diagnostic: Duplicate Macro Definition
    mac WaitLoop     ; Error: Duplicate macro 'WaitLoop'
    rts
    eom

* Diagnostic: Missing Macro Terminator
    mac BadMacro     ; Error: Missing eom/<<< terminator
    lda #0
* (No eom here)

* Diagnostic: 65816 Unsupported Syntax
    lda >$12345      ; Error: Unsupported 24-bit address (65816)
    rep #$20         ; Error: Unsupported 65816 opcode
    pea $0000        ; Error: Unsupported 65816 opcode
