# Token Rotation and Session Management

This document provides an exhaustive detailed explanation of the token rotation strategy, session management, and the internal logic of the `ensureValidCredentials` middleware.

## Overview

The `auth-h3client` library implements a **"Short-Lived Access Token, Long-Lived Refresh Token"** security model. This approach minimizes the attack window if an access token is leaked while maintaining a seamless user experience by rotating credentials transparently in the background.

## Cookie Taxonomy

The system relies on a specific set of cookies to maintain state and security. These cookies are primarily `HttpOnly` to prevent XSS attacks from stealing credentials.

| Cookie Name | Scope | Security | Description | TTL |
| :--- | :--- | :--- | :--- | :--- |
| `session` | `HttpOnly` | Secure, SameSite=Strict | The **Refresh Token**. Use this to prove identity to the Auth Service and request new access tokens. | Long (e.g., 30 days) |
| `canary_id` | `HttpOnly` | Secure, SameSite=Strict | **Anti-Fraud Binding**. A unique ID linked to the session. If this cookie does not match the session's internal record, the rotation is blocked (Session Hijacking protection). | Matches Session |
| `__Secure-a` | `HttpOnly` | Secure, SameSite=Strict | The **Access Token**. A short-lived JWT used for API authorization. Rotated frequently. | Short (e.g., 15 mins) |
| `a-iat` | `HttpOnly` | Secure, SameSite=Strict | **Issued At** timestamp for the access token. Used by the client to calculate local expiry without parsing the JWT. | Matches Access Token |

## The `ensureValidCredentials` Algorithm

The core logic resides in `ensureValidCredentials(event)`. This function is called by every protected route (via `defineAuthenticatedEventHandler`) and the `useAuthData` client composable.

### Step 1: Preliminary Checks (Local)

Before making any network calls, the middleware inspects the incoming request's cookies.

1.  **Retrieve Cookies**: It attempts to read `session` and `canary_id` from the request headers.
2.  **Validation**:
    -   **IF** `session` OR `canary_id` is missing:
    -   **THEN** The user is considered **Unauthenticated**.
    -   **ACTION**: Throw `401 Unauthorized` (Error: `AUTH_REQUIRED`). The client should redirect to login.

### Step 2: Access Token Evaluation

The middleware checks for the presence of the `__Secure-a` access token.

-   **Case A: Missing Access Token**
    -   Typical scenario: First page load after login, or user returned after 20 minutes.
    -   **ACTION**: Immediately trigger **Full Rotation** (Step 4).

-   **Case B: Access Token Present**
    -   The token exists, but we don't know if it's still valid or revoked. We proceed to **Step 3 (Metadata Check)**.

### Step 3: Metadata Verification & Caching

To avoid overwhelming the Auth Service with validation requests on every millisecond API call, the client uses a smart caching strategy via `MiniCache`.

1.  **Check Cache**: Is valid metadata for this specific `accessToken` string already in memory?
    -   **IF Cached**: Use the cached decision.
    -   **IF Not Cached**: Call `GET /secret/accesstoken/metadata` on the Auth Service.

#### The Metadata Request
The client sends the Access Token (Bearer) and Cookies to the Auth Service. The service checks the database and returns:

```typescript
interface ServerAccessTokenMetaData {
    authorized: boolean;       // Is the user active?
    shouldRotate: boolean;     // Is the token near expiry (e.g. < 2 mins left)?
    mfa: boolean;              // Is MFA verification pending?
    msUntilExp: number;        // Milliseconds until expiration
    refreshThreshold: number;  // Configured buffer (e.g., 5000ms)
    // ... user info ...
}
```

#### Decision Logic based on Metadata
The middleware evaluates the metadata response:

1.  **`serverError: true`** (Status 500/502)
    -   The Auth Service is having issues.
    -   **ACTION**: Assume local state is stale. Trigger **Full Rotation** (Step 4).

2.  **`mfa: true`** (Status 202)
    -   The session is valid, but sensitive actions require Step-Up Authentication.
    -   **ACTION**: Stop. Return `{ mfaRequired: true }` with status **202**.

3.  **`authorized: false`** (Status 401)
    -   The token was revoked server-side (e.g., "Logout All Devices").
    -   **ACTION**: Trigger **Full Rotation** (Step 4) to attempt a refresh. If that fails, the user is logged out.

4.  **`shouldRotate: true`**
    -   The token is valid but has less time remaining than the threshold.
    -   **ACTION**: Trigger **Full Rotation** (Step 4) to proactively get a fresh token.

5.  **Healthy State**
    -   Token is valid, authorized, and has plenty of time left.
    -   **ACTION**:
        -   Cache the metadata (TTL = `msUntilExp - threshold`).
        -   Set `event.context.accessToken` = `__Secure-a`.
        -   Set `event.context.session` = `session`.
        -   **PROCEED** to the route handler.

### Step 4: Full Rotation (The "Self-Healing" Phase)

If the access token is missing, expired, or revoked, the client attempts to use the **Refresh Token** (`session`) to get a new pair.

**Endpoint**: `POST /auth/refresh-session/rotate-every`

#### 4.1 Server-Side Deduplication (Locking)

Since a browser might fire 10 simultaneous API requests when a page loads, we must prevent 10 simultaneous rotation requests (which would cause race conditions where Request 1 gets a new token, but Request 2 invalidates it).

-   The `safeAction` utility locks execution based on the `session` cookie value.
-   **Request 1**: Acquires lock. Calls API.
-   **Requests 2-10**: Wait in a Promise queue.
-   **Resolution**: Request 1 finishes. The new tokens are applied to the Response object of Requests 2-10 automatically via `applyRotationResult`.

#### 4.2 Handling Rotation Response

| Status | Meaning | Action Taken |
| :--- | :--- | :--- |
| **201 Created** | Success | **New Tokens Issued**. Parse `Set-Cookie` headers. Update `event` context. Proceed. |
| **200 OK** | Success (No Change) | Tokens were already fresh (race condition handled server-side). Proceed. |
| **202 Accepted** | MFA Required | Return 202 to client. User needs to verify. |
| **401 Unauthorized** | Session Invalid | The refresh token is expired or revoked. **Throw 401**. Client must log in again. |
| **429 Too Many Requests** | Rate Limit | The user is spamming. Propagate `Retry-After` header. Throw 429. |
| **500 Server Error** | Api Fail | Throw 500. |

## Detailed Data Structures

### Rotation Result (Internal)

```typescript
export interface RotationSuccess {
    type: 'both';
    newToken: string;       // The new Access Token string
    newRefresh: string;     // The new Session ID (from session cookie)
    accessIat: string;      // Issued At timestamp
    rawSetCookie: string[]; // Raw Set-Cookie headers to forward
}
```

### Server Meta Data (API Response)

```typescript
export interface ServerAccessTokenMetaData {
    authorized: boolean;
    ipAddress: string;
    userAgent: string;
    date: string;       // ISO Date of login
    roles: string[] | string;
    msUntilExp: number;
    refreshThreshold: number;
    shouldRotate: boolean;
    payload: {
        // ... JWT Payload Claims ...
        sub?: string;
        exp?: number;
    }
}
```

## Frequently Asked Questions

### Why do I see a 401 loop?
If `ensureValidCredentials` throws 401, it means the **Refresh Token** is dead. The client-side `useAuthData` catches this and sets `authorized: false`. Your UI should watch this state and redirect to `/login`.

### What triggers a 202 MFA response?
If you have configured "Sensitive Actions" or "Step-Up Auth" in your backend, and the user hits a protected endpoint, the server returns 202. The client library bubbles this up. You should check for `status === 202` in your frontend fetches and show an OTP modal.

### How does the cache work?
It uses `MiniCache` (in-memory map). The key is the Access Token string. The TTL is dynamically calculated based on the token's remaining lifespan. This ensures we stop verifying *just before* the token actually expires, forcing a rotation at the right time.
