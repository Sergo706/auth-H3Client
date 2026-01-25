# Security Middleware

These utilities protect your application from automated attacks, verification bypasses, and unauthorized access.

## `botDetectorMiddleware`

A sophisticated bi-directional check that verifies if the visitor is human.

**Usage:**
```typescript
import { botDetectorMiddleware } from 'auth-h3client/v1';
// Applied globally by the Nuxt Module
```

**Flow:**
1.  Intercepts request.
2.  Reads `__Host-dr_i_n` cookie (signed "humanity" token).
3.  If missing or invalid: calls upstream `POST /check`.
4.  Upstream Service analyzes IP/User-Agent.
5.  If malicious: Returns 403.
6.  If suspicious: Returns 202 (CAPTCHA required).
7.  If safe: Signs a new `__Host-dr_i_n` cookie and proceeds.

## `hmacSignatureMiddleware`

Verifies that the request came from a trusted source (e.g., the Upstream Auth Service calling a webhook).

**Usage:**
```typescript
import { hmacSignatureMiddleware } from 'auth-h3client/v1';
```

**Configuration:**
Requires `server.hmac` to be enabled in `defineAuthConfiguration`.

**Check:**
1.  Reads `x-signature` header.
2.  Reconstructs body/query signature using `sharedSecret`.
3.  Compare. If mismatch: Throw 401.

## `isIPValid`

Simple IP Blocklist check.

**Usage:**
```typescript
import { isIPValid } from 'auth-h3client/v1';
```

**Behavior:**
1.  Extracts IP (respecting `X-Forwarded-For`).
2.  Checks local in-memory ban list (populated by `banIp`).
3.  If banned: Throw 403.

## `verifyCsrfCookie`

Prevents Cross-Site Request Forgery on state-changing methods.

**Usage:**
```typescript
import { verifyCsrfCookie } from 'auth-h3client/v1';
```

**Logic:**
1.  If GET/HEAD/OPTIONS: Skip.
2.  Read `__Host-csrf` cookie.
3.  Read `X-CSRF-Token` header.
4.  If they don't match: Throw 403 "CSRF Mismatch".
