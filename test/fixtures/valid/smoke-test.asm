; Smoke test fixture for coc.nvim integration.
; This file intentionally contains one unresolved reference to exercise diagnostics.

GetKey  ldx $C000
        bpl GetKey
        jmp NoSuchLabel
