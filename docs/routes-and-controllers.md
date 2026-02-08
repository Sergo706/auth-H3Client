# Routes and Controllers

This document covers the route registrars and controllers provided by auth-H3Client. These handle the core authentication flows: login, signup, logout, MFA verification, password reset, and OAuth.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Route Registrars](#route-registrars)
  - [useAuthRoutes](#useauthroutes)
  - [magicLinksRouter](#magiclinksrouter)
  - [useOAuthRoutes](#useoauthroutes)
- [Route Tables](#route-tables)
- [Controllers](#controllers)
- [Manual Composition](#manual-composition)
- [Prefix Customization](#prefix-customization)
- [H3 Version Differences](#h3-version-differences)

---

## Overview

### Route Mapping

The library uses three registrars to map endpoints to their respective controllers:

1.  **`useAuthRoutes`** (Core Auth)
    -   `POST /login` to `handleLogin`
    -   `POST /signup` to `handleSignUp`
    -   `POST /logout` to `handleLogout`

2.  **`magicLinksRouter`** (MFA & Reset)
    -   `GET /auth/verify-mfa/:visitor` to `verifyTempLink`
    -   `POST /auth/verify-mfa/:visitor` to `sendMfaCode`
    -   `POST /auth/password-reset` to `initPasswordReset`
    -   `GET /auth/reset-password/:visitor` to `verifyTempLink`
    -   `POST /auth/reset-password/:visitor` to `sendNewPassword`

3.  **`useOAuthRoutes`** (Social Login)
    -   `GET /oauth/:provider` to `OAuthRedirect`
    -   `GET|POST /oauth/callback/:provider` to `OAuthCallback`

---

## Route Registrars

### `useAuthRoutes`

Registers core authentication endpoints: login, signup, and logout.

**Import:**
```typescript
import { useAuthRoutes } from 'auth-h3client/v2';
```

**Usage:**
```typescript
const router = createRouter();
useAuthRoutes(router);
// Creates: POST /signup, POST /login, POST /logout
```

**With prefix:**
```typescript
useAuthRoutes(router, 'api');
// Creates: POST /api/signup, POST /api/login, POST /api/logout
```

---

### `magicLinksRouter`

Registers MFA verification and password reset endpoints using magic links.

**Import:**
```typescript
import { magicLinksRouter } from 'auth-h3client/v2';
```

**Usage:**
```typescript
const router = createRouter();
magicLinksRouter(router);
// Creates: /auth/verify-mfa/:visitor, /auth/password-reset, /auth/reset-password/:visitor
```

**With prefix:**
```typescript
magicLinksRouter(router, 'api');
// Creates: /api/auth/verify-mfa/:visitor, etc.
```

---

### `useOAuthRoutes`

Registers OAuth/OIDC authentication endpoints.

**Import:**
```typescript
import { useOAuthRoutes } from 'auth-h3client/v2';
```

**Usage:**
```typescript
const router = createRouter();
useOAuthRoutes(router);
// Creates: GET /oauth/:provider, GET|POST /oauth/callback/:provider
```

---

## Route Tables

### Authentication Routes (`useAuthRoutes`)

| Method | Path | Middleware | Controller | Request Body |
|--------|------|------------|------------|--------------|
| POST | `/signup` | `verifyCsrfCookie`, `contentType`, `limitBytes` | `handleSignUp` | `{ email, password }` |
| POST | `/login` | `verifyCsrfCookie`, `contentType`, `limitBytes` | `handleLogin` | `{ email, password }` |
| POST | `/logout` | `verifyCsrfCookie` | `handleLogout` | None |

**Response codes:**

| Endpoint | Success | Errors |
|----------|---------|--------|
| `/signup` | 201 | 400, 409, 429 |
| `/login` | 200, 202 (MFA) | 400, 401, 429 |
| `/logout` | 200 | 401 |

---

### MFA & Password Reset Routes (`magicLinksRouter`)

| Method | Path | Middleware | Controller |
|--------|------|------------|------------|
| GET | `/auth/verify-mfa/:visitor` | `noStore`, `csrfToken` | `verifyTempLink` |
| POST | `/auth/verify-mfa/:visitor` | `verifyLink`, `checkCsrf`, `contentType`, `limitBytes` | `sendMfaCode` |
| POST | `/auth/password-reset` | `checkCsrf`, `contentType`, `limitBytes` | `initPasswordReset` |
| GET | `/auth/reset-password/:visitor` | `noStore`, `csrfToken` | `verifyTempLink` |
| POST | `/auth/reset-password/:visitor` | `verifyLink`, `checkCsrf`, `contentType`, `limitBytes` | `sendNewPassword` |

**Query parameters for verification:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `temp` | string | Temporary verification token |
| `visitor` | string | User identifier (URL param) |

**Request body for code submission:**

```typescript
{
  code: string  // 7-digit numeric code
}
```

---

### OAuth Routes (`useOAuthRoutes`)

| Method | Path | Middleware | Controller |
|--------|------|------------|------------|
| GET | `/oauth/:provider` | `noStore`, `csrfToken` | `OAuthRedirect` |
| GET | `/oauth/callback/:provider` | `noStore` | `OAuthCallback` |
| POST | `/oauth/callback/:provider` | `noStore` | `OAuthCallback` |

**URL parameters:**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `:provider` | OAuth provider name | `google`, `github`, `microsoft` |

**Query parameters (callback):**

| Parameter | Description |
|-----------|-------------|
| `code` | Authorization code |
| `state` | CSRF state token |
| `error` | Error code (if failed) |

---

## Controllers

### `handleSignUp`

Handles user registration.

**Flow:**
1. Validate CSRF token
2. Parse and validate request body
3. Proxy to auth service `/signup`
4. Set authentication cookies on success

**Request:**
```typescript
POST /signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password-123"
}
```

**Response (201):**
```typescript
{
  "success": true,
  "userId": "abc123"
}
```

---

### `handleLogin`

Handles user authentication.

**Flow:**
1. Validate CSRF token
2. Parse and validate request body
3. Proxy to auth service `/login`
4. Check for MFA requirement (202)
5. Set authentication cookies on success

**Request:**
```typescript
POST /login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```typescript
{
  "success": true,
  "userId": "abc123"
}
```

**Response (202 - MFA Required):**
```typescript
{
  "mfaRequired": true,
  "message": "Please check your email for verification code"
}
```

---

### `handleLogout`

Clears authentication cookies and invalidates session.

**Request:**
```typescript
POST /logout
```

**Response (200):**
```typescript
{
  "success": true
}
```

**Cookies cleared:**
- `__Secure-a` (access token)
- `a-iat` (access token issued-at)
- `session` (refresh token)
- `iat` (refresh token issued-at)

---

### `verifyTempLink`

Validates temporary verification links (MFA or password reset).

**Flow:**
1. Extract `temp` from query and `visitor` from URL
2. Check for `canary_id` cookie
3. Verify with auth service
4. Return link metadata or redirect

**Response (200):**
```typescript
{
  "action": "verify-mfa",
  "linkType": "MFA Code"
}
```

---

### `sendMfaCode`

Submits MFA verification code.

**Flow:**
1. Validate CSRF and link first (via `verifyLink` middleware)
2. Parse 7-digit code from body
3. Verify with auth service
4. Rotate tokens on success
5. Redirect or return success

**Request:**
```typescript
POST /auth/verify-mfa/123?temp=abc...
Content-Type: application/json

{
  "code": "1234567"
}
```

**Response (200/303):**

For JSON requests:
```typescript
{
  "ok": true,
  "redirectTo": "/dashboard"
}
```

For HTML requests: HTTP 303 redirect.

---

## Manual Composition

You can compose controllers manually for custom middleware chains:

**H3 v2:**
```typescript
import { createRouter } from 'h3';
import { 
  handleLogin, 
  verifyCsrfCookie, 
  contentType, 
  limitBytes 
} from 'auth-h3client/v2';

const router = createRouter();

// Custom login with additional middleware
router.post('/custom-login', handleLogin, {
  middleware: [
    verifyCsrfCookie,
    contentType('application/json'),
    limitBytes(2048),
    customRateLimitMiddleware
  ]
});
```

**H3 v1:**
```typescript
import { createRouter } from 'h3';
import { 
  handleLogin, 
  verifyCsrfCookie, 
  contentType, 
  limitBytes 
} from 'auth-h3client/v1';

const router = createRouter();

router.use('/custom-login', verifyCsrfCookie);
router.use('/custom-login', contentType('application/json'));
router.use('/custom-login', limitBytes(2048));
router.post('/custom-login', handleLogin);
```

---

## Prefix Customization

All registrars accept an optional prefix parameter:

```typescript
// Without prefix (default)
useAuthRoutes(router);           // /login, /signup, /logout
magicLinksRouter(router);        // /auth/verify-mfa/:visitor
useOAuthRoutes(router);          // /oauth/:provider

// With 'api' prefix
useAuthRoutes(router, 'api');    // /api/login, /api/signup, /api/logout
magicLinksRouter(router, 'api'); // /api/auth/verify-mfa/:visitor
useOAuthRoutes(router, 'api');   // /api/oauth/:provider
```

**Nuxt module defaults:**

The Nuxt module uses a mixed prefix strategy:
- Core auth (`/login`, `/signup`) → no prefix
- Flows (`/auth/*`) → `/api` prefix

---

## H3 Version Differences

### Middleware Attachment

**H3 v1** uses stacked `router.use()`:
```typescript
router.use('/login', verifyCsrfCookie);
router.use('/login', contentType('application/json'));
router.use('/login', limitBytes(1024));
router.post('/login', loginHandler);
```

**H3 v2** uses inline `middleware` option:
```typescript
router.post('/login', loginHandler, {
  middleware: [verifyCsrfCookie, contentType('application/json'), limitBytes(1024)]
});
```

### Handler Definition

**H3 v1:**
```typescript
import { defineEventHandler } from 'h3';

export default defineEventHandler(async (event) => {
  // ...
});
```

**H3 v2:**
```typescript
import { defineHandler } from 'h3';

export default defineHandler(async (event) => {
  // ...
});
```

### Response Status

**H3 v1:**
```typescript
event.res.statusCode = 202;
```

**H3 v2:**
```typescript
event.res.status = 202;
```

---

## See Also

- [Configuration](./configuration.md) - Server and redirect settings
- [OAuth](./oauth.md) - OAuth provider configuration
- [MFA Flows](./mfa-flow/overview.md) - MFA flow documentation
- [H3 v1 vs v2](./h3-v1-v2.md) - Version compatibility guide
- [Token Rotation](./token-rotation.md) - Token management
