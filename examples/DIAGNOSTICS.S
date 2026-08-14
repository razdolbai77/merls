* @razdolbai/merls - Diagnostic Examples
* Intentionally invalid syntax demonstrating the diagnostics the language
* server emits. Open EXAMPLE.S for the diagnostics-free feature showcase.

        ORG     $2000

* Diagnostic: Duplicate Symbol Definition
DupLabel                ; first definition of DupLabel
        NOP
DupLabel                ; duplicate-symbol: DupLabel defined twice
        NOP

* Diagnostic: Unresolved Reference
        LDA     MissingValue ; unresolved-reference: MissingValue

* Diagnostic: Local label referenced outside its anchor scope
:outside
        NOP
global1
        BNE     :outside ; unresolved-reference: :outside belongs to the previous anchor
global2

* Diagnostic: Duplicate Macro Definition
WaitLoop MAC
        LDX     ]1
        EOM
WaitLoop MAC            ; duplicate-macro-definition: WaitLoop defined twice
        DEX
        EOM

* Diagnostic: Invalid Local Label in Macro
BadLocalLabel MAC
:loop                   ; invalid-macro-local-label: local labels cannot be used inside macros
]local                  ; invalid-macro-local-label: local labels cannot be used inside macros
        EOM

* Diagnostic: Case Sensitivity
        BNE     startRoutine ; unresolved-reference: labels are case-sensitive
        waitLoop #$FF   ; unsupported-instruction: waitLoop is not a known macro

* Diagnostic: Unknown Syntax
        LDA     >$12345 ; unknown-syntax: >
        rep     #$20    ; unsupported-instruction: rep
        pea     $0000   ; unsupported-instruction: pea
        blah            ; unsupported-instruction: blah

* Diagnostic: Valid Instruction, Incorrect Addressing Mode
        DEX     #10     ; invalid-addressing-mode: dex
        CLC     $1000   ; invalid-addressing-mode: clc
        JMP     #$1000  ; invalid-addressing-mode: jmp
        STA     #10     ; invalid-addressing-mode: sta
        LDA     ($10),X ; invalid-addressing-mode: lda
        STA     ($10,Y) ; invalid-addressing-mode: sta

* Diagnostic: Forward Macro Call
        ForwardMac      ; forward-macro-call: ForwardMac defined later in file

* Diagnostic: Forward Equate Reference
        LDA     ForwardEqu ; forward-equate-reference: ForwardEqu defined later in file

* Diagnostic: Macro Arity Mismatch
ArityMac MAC
        LDA     ]1
        EOM
        ArityMac #1;#2   ; macro-arity-mismatch: ArityMac expects at most 1 argument

* Diagnostic: Macro Recursion
RecurseMac MAC
        RecurseMac      ; macro-recursion: recursive macro call
        EOM

* Diagnostic: Unresolved Conditional in Macro
CondMac MAC
        DO      1       ; unresolved-conditional: DO inside macro cannot be statically resolved
        EOM

* Diagnostic: Unmatched Loop Terminator
        --^             ; unmatched-loop-terminator: standalone loop terminator

* Diagnostic: Unsupported Generated Label
        JMP     @       ; unsupported-generated-label: reference to generated label @

* Diagnostic: Invalid Data Operand
        INV     "lowercase" ; invalid-data-operand: INV payload contains lowercase text

* Diagnostic: Unterminated Loop
        LUP     5       ; unterminated-loop: missing --^ terminator
        NOP

* Diagnostic: Forward Definitions (satisfy forward references above)
ForwardMac MAC
        NOP
        EOM
ForwardEqu EQU  100
* Diagnostic: Missing Macro Terminator (keep this last: everything after
* an unclosed MAC belongs to the macro body)
BadMacro MAC            ; missing-macro-end: no eom/<<< terminator
        LDA     #0
