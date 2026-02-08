# MFA API Reference

Complete API reference for all MFA-related utilities, types, and handlers in auth-H3Client.

## Table of Contents

- [Controllers](#controllers)
- [Handler Wrappers](#handler-wrappers)
- [Utility Functions](#utility-functions)
- [Types & Schemas](#types--schemas)
- [Middleware](#middleware)
- [Configuration](#configuration)

---

## Controllers

### `sendMfaCode`

**Location:** `packages/client-h3v2/src/controllers/sendMfaCode.ts`

POST handler that validates MFA code submissions, proxies to auth server, and manages token rotation.

```typescript
import sendMfaCode from 'auth-h3client/v2';
```

**Request:**

| Field | Location | Type | Required | Description |
|-------|----------|------|----------|-------------|
| `visitor` | URL param | string | Yes | User/visitor identifier |
| `temp` | Query | string | Yes | Temporary verification token |
| `code` | Body | string | Yes | 7-digit verification code |

**Headers:**
- `Content-Type: application/json` (required)
- `X-CSRF-Token: <token>` (required)

**Cookies Required:**
- `canary_id` - Anti-fraud tracking

**Response Codes:**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 200 | Success (JSON request) | `{ ok: true, redirectTo: string }` |
| 303 | Success (HTML request) | Redirect to `onSuccessRedirect` |
| 400 | Missing body/code | `{ error: 'Invalid...' }` |
| 401 | Invalid/expired code | `{ error: 'Invalid or expired code' }` |
| 403 | Missing cookies/temp | HTTP error thrown |
| 500 | Server error | HTTP error thrown |

**Cookies Set on Success:**
- `__Secure-a` - New access token
- `a-iat` - Access token issued-at
- Additional cookies forwarded from auth server

---

### `verifyTempLink`

**Location:** `packages/client-h3v2/src/controllers/verifyTempLink.ts`

GET handler that validates temporary links (MFA or password reset).

```typescript
import verifyTempLink from 'auth-h3client/v2';
```

**Request:**

| Field | Location | Type | Required | Description |
|-------|----------|------|----------|-------------|
| `visitor` | URL param | string | Yes | User/visitor identifier |
| `temp` | Query | string | Yes | Temporary verification token |

**Cookies Required:**
- `canary_id`

**Response:**

```typescript
// Success (200)
{
  action: 'verify-mfa' | 'reset-password';
  linkType: 'MFA Code' | 'Password Reset';
}

// Invalid link - redirect to /auth
// Pattern mismatch - 404 Not Found
```

---

## Handler Wrappers

### `defineVerifiedMagicLinkGetHandler`

**Location:** `packages/client-h3v2/src/utils/verifyCustomMfaFlowGET.ts`

Higher-order function that wraps a GET handler with magic link verification.

```typescript
import { defineVerifiedMagicLinkGetHandler } from 'auth-h3client/v2';

export default defineVerifiedMagicLinkGetHandler(async (event) => {
  // Magic link verified - event.context contains verified data
  const { link, reason } = event.context;
  return handleVerifiedAction(event);
});
```

**Validation Pipeline:**

1. Assert method is GET
2. Verify CSRF token (via `defineVerifiedCsrfHandler`)
3. Check `canary_id` and `session` cookies
4. Validate query params against `VerificationLinkSchema`
5. Verify with auth server at `/auth/verify-custom-mfa/`

**Query Parameters:**

| Parameter | Type | Validation | Description |
|-----------|------|------------|-------------|
| `visitor` | number | Coerced from string | User identifier |
| `temp` | string | Required | Temp verification token |
| `random` | string | 254-500 chars | Cryptographic hash |
| `reason` | string | 0-100 chars | Action identifier |

**Event Context Set:**

```typescript
event.context.link   // string - Verified action link
event.context.reason // string - MFA flow reason
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 401 | Missing `canary_id` or `session` cookie |
| 400 | Invalid query parameters |
| 500 | Auth server communication error |

---

### `defineMfaCodeVerifierHandler`

**Location:** `packages/client-h3v2/src/utils/verifyMfaCodeHandler.ts`

Higher-order function that wraps a POST handler with MFA code verification and automatic token rotation.

```typescript
import { defineMfaCodeVerifierHandler } from 'auth-h3client/v2';

export default defineMfaCodeVerifierHandler(async (event) => {
  // Code verified, tokens rotated
  // Proceed with sensitive action
  return performAction(event);
});
```

**Validation Pipeline:**

1. Assert method is POST
2. Verify CSRF token
3. Limit body size to 8MB
4. Check `canary_id` and `session` cookies
5. Validate query params against `VerificationLinkSchema`
6. Validate `event.context.body.code` against `Code` schema (7-digit numeric)
7. Verify with auth server at `/auth/verify-custom-mfa`
8. Apply token rotation on success

**Request Body:**

```typescript
{
  code: string;  // 7-digit numeric, e.g., "1234567"
  // ... additional fields for your action
}
```

**Token Rotation:**

On success, automatically:
- Parses `accessToken` and `accessIat` from response
- Extracts `session` from `Set-Cookie` headers
- Calls `applyRotationResult()` to set all cookies

---

## Utility Functions

### `askForMfaFlow`

**Location:** `packages/client-h3v2/src/utils/askForMfaCode.ts`

Initiates a custom MFA flow by requesting the auth server to send a verification email.

```typescript
import { askForMfaFlow } from 'auth-h3client/v2';

const result = await askForMfaFlow(event, log, 'password-change', cryptoHash);
```

**Signature:**

```typescript
function askForMfaFlow(
  event: H3Event,
  log: pino.Logger,
  reason: string,
  random: string
): Promise<UtilsResponse<string>>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `event` | `H3Event` | H3 event object with cookies |
| `log` | `pino.Logger` | Logger instance |
| `reason` | `string` | Action identifier, max 100 chars |
| `random` | `string` | Crypto hash, 254-500 chars |

**Return Type:**

```typescript
type UtilsResponse<T> = 
  | { ok: true; date: string; data: T }
  | { 
      ok: false; 
      date: string; 
      reason: string; 
      code: ErrorCode;
      retryAfter?: string;
    }
```

**Error Codes:**

| Code | Description |
|------|-------------|
| `INVALID_CREDENTIALS` | Missing cookies or auth rejected |
| `HASH` | Random not 254-500 chars |
| `REASON` | Reason exceeds 100 chars |
| `FORBIDDEN` | User banned/blacklisted |
| `RATE_LIMIT` | Too many requests |
| `AUTH_SERVER_ERROR` | Server error |
| `AUTH_REJECTED` | Server rejected flow |
| `UNEXPECTED_ERROR` | Unhandled exception |

**Auth Server Endpoint:**

```
POST /custom/mfa/{reason}?random={random}
```

---

### `applyRotationResult`

**Location:** `packages/client-h3v2/src/utils/applyRotationResults.ts`

Applies token rotation results by setting appropriate cookies.

```typescript
import { applyRotationResult } from 'auth-h3client/v2';

applyRotationResult(event, rotationResult, domain, accessTokenTTL);
```

**Signature:**

```typescript
function applyRotationResult(
  event: H3Event,
  result: RotationResult | undefined | { error: string } | { text: string },
  domain: string,
  accessTokenTTL: number
): void
```

---

## Types & Schemas

### `VerificationLinkSchema`

**Location:** `packages/shared/src/types/VerificationLinkSchema.ts`

Zod schema for validating magic link query parameters.

```typescript
import { verificationLink, VerificationLinkSchema } from '@internal/shared';
```

**Schema Definition:**

```typescript
const verificationLink = z.object({
  random: makeSafeString({ min: 254, max: 500, patternMsg: "Invalid random" }),
  reason: makeSafeString({ min: 0, max: 100 }),
  visitor: z.coerce.number(),
  temp: z.string()
});

type VerificationLinkSchema = z.infer<typeof verificationLink>;
```

---

### `Code`

**Location:** `packages/shared/src/types/VerificationLinkSchema.ts`

Zod schema for validating MFA verification codes.

```typescript
import { code, Code } from '@internal/shared';
```

**Schema Definition:**

```typescript
const code = z.strictObject({ 
  code: makeSafeString({
    min: 7,
    max: 7,
    pattern: /^\d{7}$/,
    patternMsg: 'Invalid or expired code'
  })
}).required();

type Code = z.infer<typeof code>;
// { code: string } where code is exactly 7 digits
```

---

### `RotationResult`

Token rotation result type.

```typescript
interface RotationResult {
  type: 'access' | 'refresh' | 'both';
  newToken: string;
  newRefresh?: string;
  accessIat: string;
  rawSetCookie?: string[];
}
```

---

### `UtilsResponse`

Generic response type for utility functions.

```typescript
type UtilsResponse<T> =
  | {
      ok: true;
      date: string;
      data: T;
    }
  | {
      ok: false;
      date: string;
      reason: string;
      code: string;
      retryAfter?: string;
    };
```

---

## Middleware

### CSRF Middleware

**`csrfToken`** - Issues CSRF token cookie  
**`checkCsrf` / `verifyCsrfCookie`** - Validates CSRF token

```typescript
import { verifyCsrfCookie, generateCsrfCookie } from 'auth-h3client/v2';
```

### Body Limiting

**`limitBytes`** - Limits request body size

```typescript
import { limitBytes } from 'auth-h3client/v2';

// Limit to 1KB for MFA routes
limitBytes(1024)(event);

// Limit to 8MB for custom handlers
limitBytes(8000000)(event);
```

### Content Type Validation

**`contentType`** - Validates Content-Type header

```typescript
import { contentType } from 'auth-h3client/v2';

contentType('application/json')(event);
```

---

## Configuration

MFA routes use the global configuration:

```typescript
import { configuration, getConfiguration } from 'auth-h3client/v2';

// Get redirect URL
const { onSuccessRedirect } = getConfiguration();

// Get operational config (domain, TTLs)
const { domain, accessTokenTTL } = await getOperationalConfig(event);
```

**Relevant Config Options:**

| Option | Description |
|--------|-------------|
| `onSuccessRedirect` | URL to redirect after successful MFA |
| `server.cryptoCookiesSecret` | Secret for signing CSRF tokens |
| `uStorage.storage` | Storage for caching (rate limiting, etc.) |

---

## Router Registration

### `magicLinksRouter`

Registers all MFA and password reset routes.

```typescript
import { magicLinksRouter } from 'auth-h3client/v2';

// Without prefix
magicLinksRouter(router);
// Routes: /auth/verify-mfa/:visitor, /auth/reset-password/:visitor, etc.

// With prefix
magicLinksRouter(router, 'api');
// Routes: /api/auth/verify-mfa/:visitor, etc.
```

**Routes Registered:**

| Route | Method | Middleware |
|-------|--------|------------|
| `/auth/verify-mfa/:visitor` | GET | noStore, csrfToken |
| `/auth/verify-mfa/:visitor` | POST | verifyLink, checkCsrf, contentType, limitBytes |
| `/auth/password-reset` | POST | checkCsrf, contentType, limitBytes |
| `/auth/reset-password/:visitor` | GET | noStore, csrfToken |
| `/auth/reset-password/:visitor` | POST | verifyLink, checkCsrf, contentType, limitBytes |

---

## Import Paths

### H3 v2

```typescript
import {
  // Controllers
  sendMfaCode,
  verifyTempLink,
  
  // Handler wrappers
  defineVerifiedMagicLinkGetHandler,
  defineMfaCodeVerifierHandler,
  
  // Utilities
  askForMfaFlow,
  applyRotationResult,
  
  // Router
  magicLinksRouter,
  
  // Middleware
  verifyCsrfCookie,
  limitBytes,
  contentType,
} from 'auth-h3client/v2';
```

### H3 v1

```typescript
import {
  // Same exports, H3 v1 compatible
  defineVerifiedMagicLinkGetHandler,
  defineMfaCodeVerifierHandler,
  askForMfaFlow,
  magicLinksRouter,
} from 'auth-h3client/v1';
```

### Shared Types

```typescript
import {
  verificationLink,
  VerificationLinkSchema,
  code,
  Code,
} from '@internal/shared';
```
