# MFA (Multi-Factor Authentication) Flow Architecture

This document provides a comprehensive overview of the Multi-Factor Authentication implementation in auth-H3Client. The library supports two distinct MFA paradigms: **Built-in MFA** (for login/signup flows) and **Custom MFA** (for sensitive actions).

## Table of Contents

- [Overview](#overview)
- [Architecture Diagram](#architecture-diagram)
- [Flow Types](#flow-types)
- [Core Components](#core-components)
- [Cookie & Token Architecture](#cookie--token-architecture)
- [Status Codes](#status-codes)
- [Related Documentation](#related-documentation)

## Overview

auth-H3Client implements MFA as a secondary verification layer that can be triggered by the upstream [`auth`](https://github.com/Sergo706/auth) service. The MFA system is designed around:

1. **Email-based verification** - Users receive either a magic link or a 7-digit numeric code
2. **Temporary tokens** - Cryptographic tokens that expire after a short period
3. **Session binding** - MFA verification is tied to the existing session via `canary_id` and `session` cookies
4. **Automatic token rotation** - Upon successful MFA verification, both access and refresh tokens are rotated

### Key Security Properties

| Property | Description |
|----------|-------------|
| **Ephemeral tokens** | Temporary verification tokens (`temp`) with short TTL |
| **Cryptographic random** | 254-500 character random hash for request verification |
| **Session binding** | MFA validated against existing session cookies |
| **CSRF protection** | All MFA endpoints require valid CSRF tokens |
| **Token rotation** | New tokens issued upon MFA completion |
| **Request deduplication** | Protection against replay attacks via `safeAction` |

## Architecture Diagram

### Component Interaction Flow

The architecture consists of three main layers interaction:

1. **Client Application**
   - **User Interface**: Handles user input (login forms, code entry).
   - **Frontend Composables**: Manages API communication and state.

2. **auth-H3Client Gateway**
   - **Router (`magicLinksRouter`)**: Directs traffic to appropriate handlers.
   - **Handlers**: `verifyTempLink` (GET) and `sendMfaCode` (POST) process verification.
   - **Middleware**: Enforces security (CSRF, headers) before handlers execute.
   - **Custom Utilities**: facilitate developer-initiated MFA flows.

3. **Auth Service (Upstream)**
   - **MFA Endpoints**: Generates and validates the actual cryptographic tokens.
   - **Token Rotation**: Issues new session cookies upon successful verification.

**Flow Direction:**
Requests flow from **Client** $\to$ **Gateway** $\to$ **Auth Service**.
Responses flow back, with the Gateway handling cookie setting and redirection logic.

## Flow Types

### 1. Built-in MFA Flow

The built-in MFA flow is triggered when the auth server requires additional verification during login or signup. This happens when:

- User successfully authenticates with password
- Server policy requires MFA verification
- Client receives HTTP 202 response with `mfaRequired: true`

**Key files:**
- `packages/client-h3v2/src/controllers/sendMfaCode.ts`
- `packages/client-h3v2/src/controllers/verifyTempLink.ts`
- `packages/client-h3v2/src/routes/magicLinks.ts`

**See:** [Built-in MFA Flow Documentation](./built-in-flow.md)

### 2. Custom MFA Flow

The custom MFA flow allows applications to require MFA verification for sensitive actions (e.g., password change, email change, account deletion). This is a developer-initiated flow.

**Key files:**
- `packages/client-h3v2/src/utils/askForMfaCode.ts`
- `packages/client-h3v2/src/utils/verifyCustomMfaFlowGET.ts`
- `packages/client-h3v2/src/utils/verifyMfaCodeHandler.ts`

**See:** [Custom MFA Flow Documentation](./custom-flow.md)

## Core Components

### Route Registration

The `magicLinksRouter` function registers all MFA-related routes:

```typescript
import { magicLinksRouter } from 'auth-h3client/v2';

// Register routes with optional prefix
magicLinksRouter(router, 'api'); // Creates /api/auth/verify-mfa/:visitor
```

**Registered Routes:**

| Route | Method | Handler | Purpose |
|-------|--------|---------|---------|
| `/auth/verify-mfa/:visitor` | GET | `verifyTempLink` | Verify magic link validity |
| `/auth/verify-mfa/:visitor` | POST | `sendMfaCode` | Submit MFA code |
| `/auth/password-reset` | POST | `initPasswordReset` | Initiate password reset |
| `/auth/reset-password/:visitor` | GET | `verifyTempLink` | Verify reset link |
| `/auth/reset-password/:visitor` | POST | `sendNewPassword` | Submit new password |

### Middleware Stack

Each MFA route applies a specific middleware stack:

**GET routes:**
1. `noStore` - Sets `Cache-Control: no-store`
2. `csrfToken` - Issues/validates CSRF token

**POST routes:**
1. `verifyLink` - Validates the magic link first
2. `checkCsrf` - Verifies CSRF token
3. `contentType` - Validates `Content-Type: application/json`
4. `limitBytes(1024)` - Limits request body size

### Schema Validation

MFA requests are validated using Zod schemas from `@internal/shared`:

```typescript
// Verification link parameters
const verificationLink = z.object({
    random: makeSafeString({ min: 254, max: 500 }),
    reason: makeSafeString({ min: 0, max: 100 }),
    visitor: z.coerce.number(),
    temp: z.string()
});

// MFA code validation (7-digit numeric)
const code = z.strictObject({ 
    code: makeSafeString({
        min: 7,
        max: 7,
        pattern: /^\d{7}$/
    })
});
```

## Cookie & Token Architecture

### Required Cookies

| Cookie | Purpose | Flags |
|--------|---------|-------|
| `canary_id` | Anti-fraud tracking, session binding | httpOnly |
| `session` | Refresh token | httpOnly |
| `__Secure-a` | Access token | httpOnly, secure, sameSite=strict |
| `a-iat` | Access token issued-at | httpOnly |
| `iat` | Refresh token issued-at | httpOnly |

### Token Lifecycle

#### Token Lifecycle Steps
1.  **Initiation**: Client sends `POST /auth/verify-mfa/:visitor` with the code.
2.  **Gateway Security**:
    -   Validates CSRF token.
    -   Checks `canary_id` and `session` cookies for session binding.
    -   Ensures request body constraints.
3.  **Upstream Validation**: Gateway proxies the request to Auth Server (`POST /auth/verify-mfa...`) with the temp token.
4.  **Verification**: Auth Server verifies the 7-digit code.
5.  **Rotation** (On Success):
    -   Auth Server rotates the session (issues new AT/RT).
    -   Returns `200 OK` with new tokens and `Set-Cookie` headers.
6.  **Completion**: Gateway applies the rotation, sets new cookies in the browser, and redirects.

## Status Codes

MFA operations return specific HTTP status codes:

| Code | Meaning | Client Action |
|------|---------|---------------|
| 200 | MFA verified successfully | Proceed with action |
| 202 | MFA required | Show MFA UI / redirect to MFA page |
| 400 | Invalid code or parameters | Show error, allow retry |
| 401 | Missing credentials | Redirect to login |
| 403 | Forbidden (banned/blacklisted) | Show error |
| 429 | Rate limited | Wait for `Retry-After` duration |
| 500 | Server error | Show generic error |

### Detecting MFA Required

The library detects MFA requirements in multiple places:

1. **`ensureAccessToken` middleware** - Checks for 202 from token rotation
2. **`getCachedUserData`** - Returns `{ type: 'ERROR', reason: 'MFA' }` on 202
3. **`defineAuthenticatedEventHandler`** - Returns `{ mfaRequired: 'MFA required' }`

## Related Documentation

- [Built-in MFA Flow](./built-in-flow.md) - Detailed built-in flow documentation
- [Custom MFA Flow](./custom-flow.md) - Implementing custom MFA for sensitive actions
- [API Reference](./api-reference.md) - Complete API documentation
- [Security Considerations](./security-considerations.md) - Security best practices
- [Token Rotation](../token-rotation.md) - Token rotation mechanics
- [CSRF & Visitor Protection](../csrf-and-visitor.md) - CSRF protection details
