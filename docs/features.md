# Features

A comprehensive deep-dive into the capabilities provided by `auth-H3Client`.

---

## 1. Core Authentication

The library provides drop-in support for all standard authentication flows, built on top of secure HTTP-only cookies and H3 handlers.

### Login & Signup
Ready-to-use handlers for user registration and authentication.

- **Request Validation**: Automatic body parsing and validation.
- **Password Hashing**: Delegated securely to the backend auth service.
- **Session Management**: Automatic issuance of access and refresh tokens.

```typescript
// server/api/auth/[...].ts
import { createRouter } from 'h3';
import { useAuthRoutes } from 'auth-h3client/v2';

const router = createRouter();
useAuthRoutes(router); // Creates POST /login, /signup, /logout
export default useBase('/api/auth', router.handler);
```

### Multi-Factor Authentication (MFA)
Three distinct MFA strategies are supported out of the box:

1. **Built-in Flow**: Triggered automatically during login if the user has MFA enabled. Returns `202 Accepted` with a `mfaRequired` payload.
2. **Custom Flow**: Developers can trigger MFA checks for sensitive actions (e.g., changing password, viewing billing).
3. **Magic Links**: Passwordless entry via email links.

**Example: Custom MFA Check**
```typescript
import { defineMfaCodeVerifierHandler } from 'auth-h3client/v2';

export default defineMfaCodeVerifierHandler(async (event) => {
  // Only executes if MFA code is valid
  return { status: 'sensitive-action-approved' };
});
```

### Password Management
Secure flows for password resets involving email verification.
- **Forgot Password**: Initiates email sending.
- **Verify Link**: Validates the temporary link token.
- **Reset Password**: updates the credential.
51: 
52: ### Email Change
53: Secure flow for updating user email addresses.
54: - **Initiation**: Sends verification code to current email.
55: - **Verification**: Uses magic link or code entry.
56: - **Update**: Verifies password and rotates tokens upon success.

---

## 2. OAuth & OpenID Connect (OIDC)

Seamless integration with any compliant identity provider.

### Provider Agnostic
Works with:
- **OIDC**: Google, Microsoft, Okta, Auth0, etc.
- **OAuth2**: GitHub, Facebook, LinkedIn, etc.

### Auto-Discovery
Automatically fetches OIDC issuer metadata (`.well-known/openid-configuration`) to configure endpoints and signing keys.

### Security First
- **PKCE (Proof Key for Code Exchange)**: Enabled by default for all providers to prevent authorization code interception.
- **State & Nonce**: Automated generation and validation to prevent CSRF and replay attacks.
- **Cookie-Based Flow**: Temporary state is stored in secure, http-only cookies.

**Configuration Example**
```typescript
import { configuration } from 'auth-h3client';

configuration({
  OAuthProviders: [
    {
      kind: 'oidc',
      name: 'google',
      issuer: 'https://accounts.google.com',
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      redirectUri: 'https://api.myapp.com/oauth/google/callback',
      redirectUrlOnSuccess: '/dashboard'
    }
  ]
});
```

---

## 3. Security Architecture

The library implements a "secure by default" philosophy, minimizing the attack surface.

### CSRF Protection
Implements the **Double-Submit Cookie** pattern.
1. Server sets a `__Host-csrf` cookie.
2. Client reads the cookie and sends it back in a header (`X-CSRF-Token`).
3. Middleware verifies they match.

**Usage:**
```typescript
import { verifyCsrfCookie } from 'auth-h3client/v2';

// Protect a specific route
app.use('/api/mutation', verifyCsrfCookie);
```

### Token Rotation
Automatic, silent token rotation ensures users stay logged in securely without exposing long-lived tokens to the client.

- **Access Token**: Short-lived (e.g., 15 min).
- **Refresh Token**: Long-lived (e.g., 30 days), http-only, secure.
- **Rotation Logic**: Middleware automatically refreshes the access token using the refresh token when the access token expires.
- **Race Condition Handling**: `rotationLock` prevents multiple parallel requests from trying to rotate the token simultaneously.

### Bot Detection
Validates visitor integrity to prevent automated abuse.

- **Canary Cookies**: A signed "canary" cookie verifies that the client can essentially store and return cookies (filtering out simple scripts).
- **Honeypot Analysis**: Heuristics to identify non-human traffic patterns.

**Middleware Usage:**
```typescript
import { botDetectorMiddleware } from 'auth-h3client/v2';
// Apply globally or per-route
app.use(botDetectorMiddleware);
```

### IP Management
Tools to manage access based on IP address.
- **Validation**: `isIPValid` checks against allow/block lists.
- **Banning**: `banIp` utility to block malicious actors effectively.

---

## 4. Developer Experience (DX)

A suite of handler wrappers makes building secure APIs fast and type-safe.

### Handler Wrappers

#### `defineAuthenticatedEventHandler`
Protects a route, ensuring the user is logged in. Injects user data into the event context.

```typescript
export default defineAuthenticatedEventHandler(async (event) => {
  const user = event.context.user; // Typed User object
  return { message: `Hello ${user.email}` };
});
```

#### `defineOptionalAuthenticationEvent`
Does not block unauthenticated users, but populates context if a session exists.

```typescript
export default defineOptionalAuthenticationEvent(async (event) => {
  if (event.context.user) {
    return "Personalized Content";
  }
  return "Public Content";
});
```

#### `defineAuthenticatedEventPostHandlers`
Use this for **mutations (POST/PUT/DELETE)**. It enforces:
1. Authentication
2. CSRF Token Validation
3. Verified User Status

```typescript
export default defineAuthenticatedEventPostHandlers(async (event) => {
  const body = await readBody(event);
  // Safe to mutate database
  return db.update(body);
});
```

#### `defineDeduplicatedEventHandler`
Prevents duplicate processing for expensive operations (idempotency key based on user/IP).

```typescript
export default defineDeduplicatedEventHandler(async (event) => {
  // Expensive operation runs once per interval
  return performCalculation();
});
```

### Type Safety
- **Zod Validation**: Runtime validation for configuration and schemas.
- **Typed Responses**: Fully typed API responses (`MfaResponse`, `AuthServerLoginResponse`) for predictable client consumption.

---

## 5. Client Integration

First-class support for Nuxt 3 and Vue 3 via the `auth-h3client` module.

### Composables

#### `useAuthData`
Reactive access to user session state.

```typescript
const { user, isLoggedIn, login, logout } = useAuthData();

if (isLoggedIn.value) {
  console.log(user.value.email);
}
```

#### `executeRequest`
A wrapper around `$fetch` that automatically:
1. Attaches authentication headers (if needed).
2. Attaches CSRF tokens.
3. Handles 401 errors (e.g., redirect to login).

```typescript
const data = await executeRequest('/api/protected/resource', {
  method: 'POST',
  body: { foo: 'bar' }
});
```

#### `getCsrfToken`
Helper to fetch the current CSRF token for manual requests.

```typescript
const csrf = await getCsrfToken();
fetch('/api/custom', {
  headers: { 'X-CSRF-Token': csrf }
});
```

---

## 6. Server Utilities

Utilities to build robust and observable backend logic.

### Logging
- **HTTP Logger**: Structured JSON logging via Pino. Includes request ID, duration, status, and IP.

### Input Sanitization

#### `sanitizeInputString`
Strips HTML tags to prevent XSS.
```typescript
import { sanitizeInputString } from 'auth-h3client/shared';
const safe = sanitizeInputString('<script>alert(1)</script>Hello'); // "Hello"
```

#### `sanitizeBaseName`
Ensures file paths are safe (prevents directory traversal).
```typescript
import { sanitizeBaseName } from 'auth-h3client/shared';
const filename = sanitizeBaseName('../../../etc/passwd'); // "passwd"
```

#### `validateImage`
Validates image files by checking "magic bytes" (file signature) rather than just extension.
```typescript
import { validateImage } from 'auth-h3client/shared';
const isValid = await validateImage(fileBuffer);
```

### Performance & Caching

#### `limitBytes`
Middleware to prevent DoS via large request bodies.

#### `MiniCache` & `getCachedUserData`
High-performance in-memory caching for user profiles and sessions.

```typescript
import { getCachedUserData } from 'auth-h3client/v2';

// Fetches user from cache (if valid) or upstream auth service
const user = await getCachedUserData(accessToken, config);
```

---

## 7. Configuration

Flexible architecture to fit any environment.

### Storage Agnostic
Powered by `unstorage`, allowing you to use any driver:
- **Memory** (Development)
- **Redis** (Production)
- **Cloudflare KV** (Edge)
- **FileSystem**

### Remote Config
`getOperationalConfig` allows the client to sync settings dynamically from the upstream auth service, ensuring frontend and backend are always aligned on policies like password strength or MFA requirements.

### mTLS (Mutual TLS)
Support for client certificates allows zero-trust security models where the H3 server authenticates itself to the upstream Auth service via SSL certificates.

---

## 8. Nuxt Configuration Templates

The library provides starter configuration templates with sensible defaults.

👉 [View Nuxt Configuration Templates](./templates.md)


