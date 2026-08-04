export function renderMacroParameters(
  maxParameterIndex: number,
  minimumParameterCount = 0
): readonly string[] {
  const parameterCount = Math.max(maxParameterIndex, minimumParameterCount);
  return Array.from({ length: parameterCount }, (_, index) => `]${index + 1}`);
}
