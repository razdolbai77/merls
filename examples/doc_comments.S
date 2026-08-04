; Merlin32 doc comments
;
; Hover over six call sites at bottom.

; End-of-line doc comments

InlineLabel nop ;! Label documented by end-of-line comment.

InlineValue equ $2A ;! Equate documented by end-of-line comment.

InlineMacro mac ;! Macro documented by end-of-line comment.
        eom

; Preceding multi-line doc comments

;! Label documented by comments before definition.
;! Consecutive doc comment lines form one multi-line description.
PrecedingLabel nop

;! Equate documented by comments before definition.
;! Description can span multiple lines too.
PrecedingValue equ $07

;! Macro documented by comments before definition.
;! Hover shows every consecutive doc comment line.
PrecedingMacro mac
        eom

; Call sites

        jsr InlineLabel
        lda InlineValue
        InlineMacro
        jsr PrecedingLabel
        lda PrecedingValue
        PrecedingMacro
