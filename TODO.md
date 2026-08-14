# Codebase Improvement Plan

## High Priority - Bugs & Critical Issues

- [x] Extract `getCallSiteToken` type guard into shared utility; currently duplicated across multiple diagnostic and navigation modules
- [x] Add recursion depth guard to `parseExpression()` in `src/asm/expression.ts`; deeply nested expressions can cause stack overflow with no depth tracking
- [x] Fix `local-labels.ts` DRY violations: duplicate logic for local label resolution scattered across workspace indexing, symbol navigation, and diagnostic handling

## Medium Priority - Inconsistencies & Maintainability

- [x] Split `src/lsp/diagnostics.ts` into modular handler files (labels, expressions, general) for isolated testing and clearer maintenance
- [x] Replace magic `"callSiteToken"` string in `src/lsp/completion.ts:37` with named constant; appears multiple times without central definition
- [ ] Fix `effectiveLinesCache` to invalidate on document content changes rather than only identity (URI) changes

## Refactoring Opportunities

- [ ] Add type guard for unknown keys in `initializationOptions` validation path; silently ignored options should trigger warnings
- [ ] Replace indexOf pattern in `src/lsp/semantic-tokens.ts` with Map/set data structure for O(n) → O(1) lookups
- [ ] Cover 17 of 21 diagnostic codes with dedicated test fixtures; missing coverage prevents regression detection

## Testing & Documentation

- [ ] Add edge-case fixture files covering macro recursion depth limits and deeply nested call chains