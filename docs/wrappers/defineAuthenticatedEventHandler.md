# defineAuthenticatedEventHandler

This is the primary H3 wrapper for protecting API routes. It abstracts away the complexity of Request Signing, Token Verification, Session Rotation, and User Data Fetching.

## Overview

When you wrap a function with this handler, you are guaranteed that:
1.  The request comes from a legitimate source (HMAC check, if enabled).
2.  The user has a valid, active session.
3.  The user's latest data (roles, ID) is available in `event.context`.

```typescript
import { defineAuthenticatedEventHandler } from 'auth-h3client/v1';

export default defineAuthenticatedEventHandler(async (event) => {
  // If this code runs, thousands of security checks have passed.
  const userId = event.context.authorizedData!.userId;
  return { secret: 'data' };
});
```

## The Authentication Pipeline

Every request goes through this strict pipeline:

1.  **HMAC Verification**: Checks `Authorization` or `x-signature` headers against the shared secret.
    -   *Fail* -> `401 Unauthorized` (Signature Mismatch).
2.  **Credential Rotation (`ensureValidCredentials`)**:
    -   Checks cookies (`session`, `canary_id`).
    -   Rotates tokens if access token is missing or near expiry.
    -   *Fail* -> `401 Unauthorized` (Session Invalid) or `202 MFA Required`.
3.  **User Data Fetch (`getCachedUserData`)**:
    -   Calls `GET /secret/accesstoken/metadata`.
    -   Checks cache first.
    -   *Fail* -> `403 Forbidden` (Banned) or `429 Too Many Requests`.
4.  **Handler Execution**:
    -   Only if all above pass, your callback is executed.

## Context Injection

The wrapper injects typed data into `event.context`.

### `event.context.authorizedData`

This object contains the user's profile as returned by the Auth Service.

```typescript
interface ServerAccessTokenMetaData {
  authorized: boolean;       // Status
  ipAddress: string;         // Origin IP
  userAgent: string;         // Device Info
  date: string;              // Login Date
  roles: string[] | string;  // RBAC Roles (e.g. ['admin', 'editor'])
  msUntilExp: number;        // Ms until token expiration
  payload: {                 // Raw JWT Payload
    sub?: string;            // User ID
    iss?: string;            // Issuer
    // ... custom claims
  };
}
```

## Return Types and Scenarios

Your handler can return any data. However, the *wrapper itself* can return specific control responses that you should be aware of.

| Scenario | Status Code | Body Structure | Description |
| :--- | :--- | :--- | :--- |
| **Success** | `200 OK` | `T` (Your Return Type) | Normal operation. |
| **Step-Up Auth** | `202 Accepted` | `{ mfaRequired: true, message: '...' }` | The user is authenticated, but this specific action triggered a security rule (e.g. "Change Password" requires Email OTP). The client should display an OTP modal. |
| **Invalid Session** | `401 Unauthorized` | `{ statusCode: 401, message: '...' }` | Session expired or revoked. Client should redirect to Login. |
| **Rate Limited** | `429 Too Many Requests` | `{ statusCode: 429, message: '...' }` | User is spamming the auth checks. Includes `Retry-After` header. |
| **Banned/Blocked** | `403 Forbidden` | `{ statusCode: 403, message: '...' }` | User or IP is blacklisted. |

## Advanced Usage

### Accessing the Raw Token

If you need to pass the access token to another microservice:

```typescript
export default defineAuthenticatedEventHandler((event) => {
  const token = event.context.accessToken; // Populated by rotation logic
  
  await fetch('https://other-service.internal/api', {
    headers: { Authorization: `Bearer ${token}` }
  });
});
```

### Extending Validation

You can add your own checks *inside* the handler.

```typescript
export default defineAuthenticatedEventHandler((event) => {
  const user = event.context.authorizedData!;
  
  // Custom RBAC Check
  if (!user.roles.includes('super-admin')) {
    throw createError({ statusCode: 403, message: 'Super Admin only' });
  }
  
  // Custom IP Check
  if (user.ipAddress !== '10.0.0.5') {
    throw createError({ statusCode: 403, message: 'VPN required' });
  }
});
```
