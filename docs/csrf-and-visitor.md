# CSRF and Visitor Validation

Two layers protect forms and page views.

## CSRF

- Issuance: `csrf` middleware (src/middleware/csrf.ts) sets a signed cookie `__Host-csrf` when missing.
- Verification: `verifyCsrf` (src/middleware/verifyCsrf.ts) checks the cookie + `X-CSRF-Token` header.

Usage:

```ts
app.use(generateCsrfCookie);
router.post('/signup', handler, { middleware: [verifyCsrfCookie] });
```

## Visitor validator (canary)

- `validator` (src/middleware/visitorValid.ts) sets a signed canary cookie for page views.
- Calls `/check` on the auth service; bans IPs on malicious signals.

Notes:

- Skips static assets and `/.well-known/*` paths.
- Throws 403 on suspected tampering.

