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

For convenient handler wrapping, use `defineVerifiedCsrfHandler`. See [CSRF Verifier Wrapper](wrappers/csrfVerifier.md).

## Visitor validator (canary) / Bot detector

- `validator` (src/middleware/visitorValid.ts) integrates with the auth service's botDetector module.
- It sets a signed canary cookie for page views and calls the auth service's `/check` endpoint.
- When the upstream service flags a visitor as malicious, the middleware bans the IP and throws 403.
> [!WARNING]
> This middleware attempts to ban IPs using `ufw`. If you are in a **Serverless** environment (Vercel, AWS Lambda, etc.) or lack `sudo` permissions, you **must** disable the firewall feature via config or ensure the code catches the error gracefully.

Important:

- Only wire this middleware if your auth service is configured with the botDetector enabled and exposes `/check`.
- Place it early in your middleware chain so it runs before CSRF and route handlers.
- For performance, it uses a keep‑alive `undici` Agent (see `getAuthAgent(true)`).

Wiring example:

```ts
import { botDetectorMiddleware as validator } from 'auth-h3client';

app.use(validator); // enable when /check is enabled on the auth service
```
