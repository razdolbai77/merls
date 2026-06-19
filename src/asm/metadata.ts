export type AddressingMode =
  | "implied"
  | "accumulator"
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
};

export type DirectiveDefinition = {
  name: string;
  kind: DirectiveKind;
  supported: boolean;
  summary: string;
};

function defineOpcode(
  mnemonic: string,
  modes: readonly AddressingMode[]
): OpcodeDefinition {
  return {
    mnemonic,
    modes
  };
}

function defineDirective(
  name: string,
  kind: DirectiveKind,
  supported: boolean,
  summary: string
): DirectiveDefinition {
  return {
    name,
    kind,
    supported,
    summary
  };
}

export const opcodeDefinitions: readonly OpcodeDefinition[] = [
  defineOpcode("adc", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"]),
  defineOpcode("and", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"]),
  defineOpcode("asl", ["accumulator", "zeroPage", "zeroPageX", "absolute", "absoluteX"]),
  defineOpcode("bcc", ["relative"]),
  defineOpcode("bcs", ["relative"]),
  defineOpcode("beq", ["relative"]),
  defineOpcode("bit", ["zeroPage", "absolute"]),
  defineOpcode("bmi", ["relative"]),
  defineOpcode("bne", ["relative"]),
  defineOpcode("bpl", ["relative"]),
  defineOpcode("brk", ["implied"]),
  defineOpcode("bvc", ["relative"]),
  defineOpcode("bvs", ["relative"]),
  defineOpcode("clc", ["implied"]),
  defineOpcode("cld", ["implied"]),
  defineOpcode("cli", ["implied"]),
  defineOpcode("clv", ["implied"]),
  defineOpcode("cmp", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"]),
  defineOpcode("cpx", ["immediate", "zeroPage", "absolute"]),
  defineOpcode("cpy", ["immediate", "zeroPage", "absolute"]),
  defineOpcode("dec", ["zeroPage", "zeroPageX", "absolute", "absoluteX"]),
  defineOpcode("dex", ["implied"]),
  defineOpcode("dey", ["implied"]),
  defineOpcode("eor", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"]),
  defineOpcode("inc", ["zeroPage", "zeroPageX", "absolute", "absoluteX"]),
  defineOpcode("inx", ["implied"]),
  defineOpcode("iny", ["implied"]),
  defineOpcode("jmp", ["absolute", "indirect"]),
  defineOpcode("jsr", ["absolute"]),
  defineOpcode("lda", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"]),
  defineOpcode("ldx", ["immediate", "zeroPage", "zeroPageY", "absolute", "absoluteY"]),
  defineOpcode("ldy", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX"]),
  defineOpcode("lsr", ["accumulator", "zeroPage", "zeroPageX", "absolute", "absoluteX"]),
  defineOpcode("nop", ["implied"]),
  defineOpcode("ora", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"]),
  defineOpcode("pha", ["implied"]),
  defineOpcode("php", ["implied"]),
  defineOpcode("pla", ["implied"]),
  defineOpcode("plp", ["implied"]),
  defineOpcode("rol", ["accumulator", "zeroPage", "zeroPageX", "absolute", "absoluteX"]),
  defineOpcode("ror", ["accumulator", "zeroPage", "zeroPageX", "absolute", "absoluteX"]),
  defineOpcode("rti", ["implied"]),
  defineOpcode("rts", ["implied"]),
  defineOpcode("sbc", ["immediate", "zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"]),
  defineOpcode("sec", ["implied"]),
  defineOpcode("sed", ["implied"]),
  defineOpcode("sei", ["implied"]),
  defineOpcode("sta", ["zeroPage", "zeroPageX", "absolute", "absoluteX", "absoluteY", "indexedIndirect", "indirectIndexed"]),
  defineOpcode("stx", ["zeroPage", "zeroPageY", "absolute"]),
  defineOpcode("sty", ["zeroPage", "zeroPageX", "absolute"]),
  defineOpcode("tax", ["implied"]),
  defineOpcode("tay", ["implied"]),
  defineOpcode("tsx", ["implied"]),
  defineOpcode("txa", ["implied"]),
  defineOpcode("txs", ["implied"]),
  defineOpcode("tya", ["implied"])
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
  defineDirective("equ", "assembler", true, "Define a symbolic constant."),
  defineDirective("err", "assembler", true, "Force an assembly error."),
  defineDirective("hex", "data", true, "Emit raw hexadecimal bytes."),
  defineDirective("mac", "assembler", true, "Begin a macro definition."),
  defineDirective("mx", "mode", false, "65816-only accumulator and index width control."),
  defineDirective("org", "assembler", true, "Set or restore the assembly origin."),
  defineDirective("put", "include", true, "Include another source file."),
  defineDirective("sav", "build", true, "Save an output file."),
  defineDirective("sna", "build", true, "Set the output file name."),
  defineDirective("str", "data", true, "Emit a Merlin string."),
  defineDirective("typ", "build", true, "Set the output file type."),
  defineDirective("use", "include", true, "Include a library-style source file."),
  defineDirective("xc", "mode", false, "65816-only extended instruction mode control.")
];

export const directiveTable = new Map(
  directiveDefinitions.map((definition) => [definition.name, definition] as const)
);
