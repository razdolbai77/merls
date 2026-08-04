export type AddressingMode =
  | "implied"
  | "immediate"
  | "zeroPage"
  | "zeroPageX"
  | "zeroPageY"
  | "relative"
  | "absolute"
  | "absoluteX"
  | "absoluteY"
  | "indirect"
  | "indexedIndirect"
  | "indirectIndexed";

export type DirectiveKind =
  | "assembler"
  | "build"
  | "data"
  | "include"
  | "mode"
  | "storage";

export type OpcodeDefinition = {
  mnemonic: string;
  modes: readonly AddressingMode[];
  description: string;
};

export type DirectiveDefinition = {
  name: string;
  kind: DirectiveKind;
  supported: boolean;
  summary: string;
  completions?: readonly string[];
};

export function normalizeMnemonic(lexeme: string): string {
  return lexeme.endsWith(":") ? lexeme.slice(0, -1).toLowerCase() : lexeme.toLowerCase();
}

function defineOpcode(
  mnemonic: string,
  modes: readonly AddressingMode[],
  description: string
): OpcodeDefinition {
  return {
    mnemonic,
    modes,
    description
  };
}

function defineDirective(
  name: string,
  kind: DirectiveKind,
  supported: boolean,
  summary: string,
  completions?: readonly string[]
): DirectiveDefinition {
  return {
    name,
    kind,
    supported,
    summary,
    completions
  };
}

export const opcodeDefinitions: readonly OpcodeDefinition[] = [
  defineOpcode("adc", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"], "Add with Carry"),
  defineOpcode("and", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"], "Logical AND"),
  defineOpcode("asl", ["implied", "zeroPage", "zeroPageX", "absolute", "absoluteX"], "Arithmetic Shift Left"),
  defineOpcode("bcc", ["relative"], "Branch if Carry Clear"),
  defineOpcode("bcs", ["relative"], "Branch if Carry Set"),
  defineOpcode("beq", ["relative"], "Branch if Equal"),
  defineOpcode("bit", ["zeroPage", "absolute"], "Bit Test"),
  defineOpcode("bmi", ["relative"], "Branch if Minus"),
  defineOpcode("bne", ["relative"], "Branch if Not Equal"),
  defineOpcode("bpl", ["relative"], "Branch if Positive"),
  defineOpcode("brk", ["implied"], "Force Interrupt"),
  defineOpcode("bvc", ["relative"], "Branch if Overflow Clear"),
  defineOpcode("bvs", ["relative"], "Branch if Overflow Set"),
  defineOpcode("clc", ["implied"], "Clear Carry Flag"),
  defineOpcode("cld", ["implied"], "Clear Decimal Mode"),
  defineOpcode("cli", ["implied"], "Clear Interrupt Disable"),
  defineOpcode("clv", ["implied"], "Clear Overflow Flag"),
  defineOpcode("cmp", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"], "Compare"),
  defineOpcode("cpx", ["immediate", "zeroPage", "absolute"], "Compare X Register"),
  defineOpcode("cpy", ["immediate", "zeroPage", "absolute"], "Compare Y Register"),
  defineOpcode("dec", ["zeroPage", "zeroPageX", "absolute", "absoluteX"], "Decrement Memory"),
  defineOpcode("dex", ["implied"], "Decrement X Register"),
  defineOpcode("dey", ["implied"], "Decrement Y Register"),
  defineOpcode("eor", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"], "Exclusive OR"),
  defineOpcode("inc", ["zeroPage", "zeroPageX", "absolute", "absoluteX"], "Increment Memory"),
  defineOpcode("inx", ["implied"], "Increment X Register"),
  defineOpcode("iny", ["implied"], "Increment Y Register"),
  defineOpcode("jmp", ["absolute", "indirect", "indexedIndirect"], "Jump"),
  defineOpcode("jsr", ["absolute"], "Jump to Subroutine"),
  defineOpcode("lda", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"], "Load Accumulator"),
  defineOpcode("ldx", ["immediate", "zeroPage", "zeroPageY", "absolute", "absoluteY"], "Load X Register"),
  defineOpcode("ldy", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX"], "Load Y Register"),
  defineOpcode("lsr", ["implied", "zeroPage", "zeroPageX", "absolute", "absoluteX"], "Logical Shift Right"),
  defineOpcode("nop", ["implied"], "No Operation"),
  defineOpcode("ora", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"], "Logical Inclusive OR"),
  defineOpcode("pha", ["implied"], "Push Accumulator"),
  defineOpcode("php", ["implied"], "Push Processor Status"),
  defineOpcode("pla", ["implied"], "Pull Accumulator"),
  defineOpcode("plp", ["implied"], "Pull Processor Status"),
  defineOpcode("rol", ["implied", "zeroPage", "zeroPageX", "absolute", "absoluteX"], "Rotate Left"),
  defineOpcode("ror", ["implied", "zeroPage", "zeroPageX", "absolute", "absoluteX"], "Rotate Right"),
  defineOpcode("rti", ["implied"], "Return from Interrupt"),
  defineOpcode("rts", ["implied"], "Return from Subroutine"),
  defineOpcode("sbc", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"], "Subtract with Carry"),
  defineOpcode("sec", ["implied"], "Set Carry Flag"),
  defineOpcode("sed", ["implied"], "Set Decimal Flag"),
  defineOpcode("sei", ["implied"], "Set Interrupt Disable"),
  defineOpcode("sta", ["zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"], "Store Accumulator"),
  defineOpcode("stx", ["zeroPage", "zeroPageY", "absolute"], "Store X Register"),
  defineOpcode("sty", ["zeroPage", "zeroPageX", "absolute"], "Store Y Register"),
  defineOpcode("tax", ["implied"], "Transfer Accumulator to X"),
  defineOpcode("tay", ["implied"], "Transfer Accumulator to Y"),
  defineOpcode("tsx", ["implied"], "Transfer Stack Pointer to X"),
  defineOpcode("txa", ["implied"], "Transfer X to Accumulator"),
  defineOpcode("txs", ["implied"], "Transfer X to Stack Pointer"),
  defineOpcode("tya", ["implied"], "Transfer Y to Accumulator")
];

export const opcodeTable = new Map(
  opcodeDefinitions.map((definition) => [definition.mnemonic, definition] as const)
);

export const directiveDefinitions: readonly DirectiveDefinition[] = [
  defineDirective("asm", "include", true, "Assemble another source file immediately."),
  defineDirective("asc", "data", true, "Emit an ASCII string."),
  defineDirective("da", "data", true, "Emit an address-sized value."),
  defineDirective("db", "data", true, "Emit byte data."),
  defineDirective("dend", "storage", true, "End a DUM storage section."),
  defineDirective("dsk", "build", true, "Set the output disk or image name."),
  defineDirective("ds", "storage", true, "Reserve storage bytes."),
  defineDirective("dum", "storage", true, "Begin a DUM storage section."),
  defineDirective("end", "assembler", true, "End assembly."),
  defineDirective("equ", "assembler", true, "Define a symbolic constant."),
  defineDirective("err", "assembler", true, "Force an assembly error."),
  defineDirective("hex", "data", true, "Emit raw hexadecimal bytes."),
  defineDirective("mac", "assembler", true, "Begin a macro definition."),
  defineDirective("eom", "assembler", false, "End a macro definition."),
  defineDirective("<<<", "assembler", false, "End a macro definition."),
  defineDirective("mx", "mode", false, "Unknown width-control directive.", ["%00", "%01", "%10", "%11"]),
  defineDirective("org", "assembler", true, "Set or restore the assembly origin."),
  defineDirective("put", "include", true, "Include another source file."),
  defineDirective("sav", "build", true, "Save an output file."),
  defineDirective("sna", "build", true, "Set the output file name."),
  defineDirective("str", "data", true, "Emit a Merlin string."),
  defineDirective("typ", "build", true, "Set the output file type.", ["$00", "$04", "$06", "$F1", "$F9", "$FA", "$FC", "$FD", "$FE", "$FF", "NON", "TXT", "BIN", "OBJ", "OS", "INT", "BAS", "VAR", "REL", "SYS"]),
  defineDirective("use", "include", true, "Include a library-style source file."),
  defineDirective("xc", "mode", false, "Unknown mode-control directive.", ["off"]),
  defineDirective("lst", "assembler", true, "Control listing output."),
  defineDirective("do", "assembler", true, "Begin conditional assembly block."),
  defineDirective("fin", "assembler", true, "End conditional assembly block."),
  defineDirective("if", "assembler", true, "Begin conditional assembly."),
  defineDirective("else", "assembler", true, "Else branch for conditional assembly."),
  defineDirective("dfb", "data", true, "Emit byte data."),
  defineDirective("ddb", "data", true, "Emit double-byte data."),
  defineDirective("dw", "data", true, "Emit word data."),
  defineDirective("dci", "data", true, "Emit DCI string."),
  defineDirective("inv", "data", true, "Emit an inverse text string."),
  defineDirective("fls", "data", true, "Emit a flashing text string."),
  defineDirective("rev", "data", true, "Emit a reversed string."),
  defineDirective("strl", "data", true, "Emit a length-prefixed string.")
];

export const directiveTable = new Map(
  directiveDefinitions.map((definition) => [definition.name, definition] as const)
);
