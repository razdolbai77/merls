/** Get the call-site token for a token on an expanded line, or null otherwise.

This utility replaces duplicated checks of `isExpanded` and `(token as ExpandedToken).callSiteToken`
across multiple LSP handlers. Call sites represent the concrete argument tokens that macro
callers use; body-derived tokens have `null` call-site information so navigation never
emits columns on macro-body lines.

Usage:

```typescript
if (getCallSiteToken(token, isExpanded)) {
  // token is an ExpandedToken with a valid call-site reference
}
```
*/

export { CALL_SITE_TOKEN_KEY, getCallSiteToken } from "../asm/expansion";
