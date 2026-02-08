# CSRF and Visitor Protection

This document covers two essential security mechanisms in auth-H3Client: **CSRF (Cross-Site Request Forgery) protection** and **Visitor validation (Bot Detection)**. Both are critical for securing your application against common web attacks.

## Table of Contents

- [Overview](#overview)
- [CSRF Protection](#csrf-protection)
  - [How CSRF Attacks Work](#how-csrf-attacks-work)
  - [Token Generation](#token-generation)
  - [Token Verification](#token-verification)
  - [Cookie Configuration](#cookie-configuration)
  - [Client Integration](#client-integration)
- [Visitor Validation (Bot Detection)](#visitor-validation-bot-detection)
  - [Canary Cookie](#canary-cookie)
  - [Bot Detection Flow](#bot-detection-flow)
  - [IP Banning](#ip-banning)
- [Middleware Reference](#middleware-reference)
- [Configuration](#configuration)
- [Best Practices](#best-practices)

---

## Overview

### Middleware Execution Order

Requests flow through the security middleware stack in the following order:

1.  **IP Validation** (`isIPValid`)
    -   Checks if IP is malformed or in the ban list.
    -   *Result*: Proceeds or returns `403 Forbidden`.
2.  **Bot Detection** (`botDetectorMiddleware`)
    -   Analyzes request patterns (User-Agent, headers) via Auth Service.
    -   *Result*: Proceeds or bans IP + `403 Forbidden`.
3.  **CSRF Generation** (`generateCsrfCookie`)
    -   Issues a signed `__Host-csrf` cookie if missing.
4.  **Route Handler Execution**
5.  **CSRF Verification** (`verifyCsrfCookie` - on mutation)
    -   Validates header token against signed cookie.
    -   *Result*: Executes handler or rejects with `403`.

| Layer | Middleware | Purpose |
|-------|------------|---------|
| 1 | `isIPValid` | Validates IP format, checks ban list |
| 2 | `botDetectorMiddleware` | Detects and blocks bot traffic |
| 3 | `generateCsrfCookie` | Issues signed CSRF token cookie |
| 4 | `verifyCsrfCookie` | Validates CSRF token on mutations |

---

## CSRF Protection

### How CSRF Attacks Work

Cross-Site Request Forgery tricks authenticated users into performing unwanted actions. An attacker creates a malicious page that submits requests to your application using the victim's authenticated session.

```
┌─────────────────────────────────────────────────────────────────┐
│                     CSRF Attack Flow                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User logs into yourapp.com (session cookie set)            │
│                                                                 │
│  2. User visits evil.com (while logged into yourapp.com)       │
│                                                                 │
│  3. evil.com has hidden form:                                  │
│     <form action="https://yourapp.com/transfer" method="POST"> │
│       <input name="to" value="attacker">                       │
│       <input name="amount" value="1000">                       │
│     </form>                                                    │
│     <script>document.forms[0].submit()</script>                │
│                                                                 │
│  4. Browser automatically includes yourapp.com cookies         │
│                                                                 │
│  5. Without CSRF protection → Transfer succeeds!               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Token Generation

The `generateCsrfCookie` middleware creates a signed CSRF token and sets it as an HttpOnly cookie.

**Import:**
```typescript
import { generateCsrfCookie } from 'auth-h3client/v2';
```

**Usage:**
```typescript
// Global middleware (recommended)
app.use(generateCsrfCookie);

// Or per-route
router.get('/form', formHandler, { middleware: [generateCsrfCookie] });
```

**How it works:**

1. Generates 32 random bytes using `crypto.randomBytes`
2. Signs the token with `cryptoCookiesSecret` from config
3. Sets `__Host-csrf` cookie with secure flags

**Cookie set:**
```
__Host-csrf=<signed_token>; HttpOnly; Secure; SameSite=Lax; Path=/
```

> [!NOTE]
> The `__Host-` prefix ensures the cookie is only set on secure origins and cannot be overwritten by subdomains. This prevents cookie tossing attacks.

### Token Verification

The `verifyCsrfCookie` middleware validates the CSRF token on state-changing requests.

**Import:**
```typescript
import { verifyCsrfCookie } from 'auth-h3client/v2';
```

**Usage:**
```typescript
// With defineVerifiedCsrfHandler (recommended)
import { defineVerifiedCsrfHandler } from 'auth-h3client/v2';

export default defineVerifiedCsrfHandler(async (event) => {
  // CSRF verified, safe to process mutation
  return { success: true };
});

// Direct middleware usage
router.post('/submit', handler, { middleware: [verifyCsrfCookie] });
```

**Verification flow:**

#### Verification Logic
1.  **Check Header**: Does `X-CSRF-Token` exist?
    -   *Yes*: Extract token.
    -   *No*: Check `_csrf` in body.
2.  **Validate**: Compare extracted token with the signed `__Host-csrf` cookie payload.
    -   *Match*: Request proceeds.
    -   *Mismatch/Missing*: Request rejected with `403 Forbidden`.

**Token sources (checked in order):**
1. `X-CSRF-Token` header
2. `_csrf` field in request body

### Cookie Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| Name | `__Host-csrf` | Secure prefix prevents subdomain override |
| HttpOnly | `true` | Prevents JavaScript access |
| Secure | `true` | HTTPS only |
| SameSite | `Lax` | Prevents cross-origin POST |
| Path | `/` | Available site-wide |
| MaxAge | Session | Expires when browser closes |

### Client Integration

**Getting the CSRF token:**

```typescript
// Using the client helper
import { getCsrfToken } from 'auth-h3client/client';

const token = getCsrfToken();
```

**Sending with fetch:**

```typescript
// Header method (recommended)
await fetch('/api/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCsrfToken()
  },
  body: JSON.stringify(data)
});

// Body method
await fetch('/api/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    _csrf: getCsrfToken(),
    ...data 
  })
});
```

**With Nuxt `$fetch`:**

```typescript
// Auto-handled by executeRequest
import { executeRequest } from 'auth-h3client/client';

await executeRequest('/api/submit', 'POST', data);
// CSRF token automatically included!
```

---

## Visitor Validation (Bot Detection)

The visitor validation system uses a **canary cookie** pattern combined with server-side bot detection to identify and block malicious traffic.

### Canary Cookie

The `canary_id` cookie is a unique identifier that:
- Binds sessions to anti-fraud tracking
- Enables cross-request correlation for bot detection
- Is required for authenticated requests

**Cookie format:**
```
canary_id=<signed_unique_id>; HttpOnly; Secure; SameSite=Strict
```

### Bot Detection Flow

#### Bot Detection Process
1.  **Analysis**: Middleware extracts User-Agent, IP, and Headers.
2.  **Canary Check**: Checks for existing `canary_id` cookie.
    -   *Missing*: Generates and sets a new canary ID.
3.  **Fingerprinting**: Sends data to Auth Service (`POST /check`).
4.  **Decision**:
    -   **Human**: Auth Service returns `{ bot: false }`. Request proceeds.
    -   **Bot**: Auth Service returns `{ bot: true }`.
        -   Middleware bans IP (if UFW enabled).
        -   Returns `403 Forbidden`.

### IP Banning

When a bot is detected and `enableFireWallBans` is `true`, the middleware bans the IP using UFW:

```bash
sudo ufw insert 1 deny from <IP> comment "auth-h3client bot ban"
```

> [!WARNING]
> **Serverless Compatibility**  
> If deploying to **Vercel, Netlify, Cloudflare Workers, or AWS Lambda**, set `enableFireWallBans: false`. These environments don't support system-level firewalls.

**IP Validation (`isIPValid`):**

Before bot detection, the middleware validates:
1. IP address format (IPv4 or IPv6)
2. Not in internal ban list
3. Not a malformed header

```typescript
import { isIPValid } from 'auth-h3client/v2';

app.use(isIPValid);
```

---

## Middleware Reference

### `generateCsrfCookie`

| Property | Value |
|----------|-------|
| Source | `src/middleware/csrf.ts` |
| Type | Global middleware |
| Methods | All (generates on first request) |

### `verifyCsrfCookie`

| Property | Value |
|----------|-------|
| Source | `src/middleware/verifyCsrf.ts` |
| Type | Route middleware |
| Methods | POST, PUT, DELETE, PATCH |
| Error | 403 Forbidden |

### `botDetectorMiddleware`

| Property | Value |
|----------|-------|
| Source | `src/middleware/visitorValid.ts` |
| Type | Global middleware |
| Requires | Auth service with `/check` endpoint enabled |
| Error | 403 Forbidden |

### `isIPValid`

| Property | Value |
|----------|-------|
| Source | `src/middleware/isValidIP.ts` |
| Type | Global middleware |
| Error | 403 Forbidden |

---

## Configuration

CSRF and bot detection are configured via the main `configuration()` call:

```typescript
configuration({
  server: {
    // Secret for signing CSRF tokens and cookies
    cryptoCookiesSecret: 'your-32-char-minimum-secret-here'
  },
  
  // Enable/disable firewall bans
  enableFireWallBans: true  // Set to false for serverless
});
```

**Environment-specific:**

```typescript
configuration({
  enableFireWallBans: process.env.NODE_ENV === 'production' 
    && !process.env.SERVERLESS
});
```

---

## Best Practices

### CSRF

1. **Always use on mutations** - POST, PUT, DELETE, PATCH
2. **Never rely on SameSite alone** - Some browsers don't fully support it
3. **Use `__Host-` prefix** - Already done by default
4. **Regenerate on login** - Prevents session fixation

### Bot Detection

1. **Enable early in middleware chain** - Before CSRF and auth
2. **Monitor false positives** - Log blocked requests for review
3. **Use with rate limiting** - Defense in depth
4. **Configure auth service** - Ensure `/check` endpoint is enabled

### General

1. **Use HTTPS** - Required for secure cookies
2. **Set proper CORS** - Limit allowed origins
3. **Log security events** - Track blocked requests

---

## See Also

- [defineVerifiedCsrfHandler](./wrappers/csrfVerifier.md) - CSRF wrapper for handlers
- [Configuration](./configuration.md) - Full configuration reference
- [Logging & Errors](./logging-and-errors.md) - Error handling
