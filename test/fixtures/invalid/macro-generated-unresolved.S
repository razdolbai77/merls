; Source: apple2accumulator/merlin32
; Invalid fixture for macro-generated unresolved reference coverage.
; Expected diagnostic category: macro-generated unresolved reference.

UseMissing mac
        lda MissingSymbol
        sta ]1
        eom

Start   UseMissing $2000
