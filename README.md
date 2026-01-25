# auth-H3Client

**The definitive H3/Nuxt client for the [Auth Service](https://github.com/Sergo706/auth).**

This library provides the "glue" code to connect your Nuxt 3 or H3 application to the upstream Auth Service. It handles the complexity of:
1.  **Token Rotation**: Transparently refreshing short-lived access tokens.
2.  **Security**: CSRF, Bot Detection, IP Banning, HMAC Signing.
3.  **Authentication Flows**: OIDC, OAuth, Magic Links, Passwords.
4.  **State Management**: Request Deduplication and Caching.

## Documentation Index

> **Compatible with H3 v1 and v2**
> - H3 **v1**: Import from `auth-h3client/v1`
> - H3 **v2**: Import from `auth-h3client/v2`

### Core Concepts

| Topic | Description |
| :--- | :--- |
| [**Module Configuration**](docs/module.md) | **START HERE**. Full reference for `nuxt.config.ts` and `defineAuthConfiguration`. |
| [**Client-Side Strategy**](docs/client.md) | How to use `useAuthData`, `getCsrfToken`, and `ofetch` to build your UI. |
| [**Token Rotation**](docs/token-rotation.md) | Deep dive into the `ensureValidCredentials` algorithm and cookie lifecycle. |
| [**Authenticated Route Wrapper**](docs/wrappers/defineAuthenticatedEventHandler.md) | The primary backend wrapper `defineAuthenticatedEventHandler`. |
| [**Deduplication Wrapper**](docs/wrappers/defineDeduplicatedEventHandler.md) | How `defineDeduplicatedEventHandler` prevents race conditions. |

### Utilities Reference (The "Map of Everything")

Every exported function is documented below.

#### Authentication Flow
*Files: `login`, `logout`, `signup`, `oauth`*
[**View Docs →**](docs/utilities/auth-flow.md)

| Export | Description |
| :--- | :--- |
| `loginHandler` | Handles `POST /login`. Validates credentials vs Auth Service. |
| `logoutHandler` | Handles `POST /logout`. Revokes session. |
| `signUpHandler` | Handles `POST /signup`. Creates new user. |
| `OAuthRedirect` | Starts an OAuth flow (redirects to Google/GitHub etc). |
| `OAuthSuccessCallBack` | Handles the OAuth return callback. |
| `verifyTempLinkHandler` | Verifies Magic Links / Email Verifications. |
| `sendMfaCodeHandler` | Triggers an MFA email. |
| `restartPasswordHandler` | Starts password reset flow. |

#### Security Middleware
*Files: `csrf`, `bots`, `ip`, `signatures`*
[**View Docs →**](docs/utilities/security-middleware.md)

| Export | Description |
| :--- | :--- |
| `botDetectorMiddleware` | Validates visitor humanity via Auth Service `/check`. |
| `hmacSignatureMiddleware` | Verifies `x-signature` header from upstream. |
| `isIPValid` | Checks if the request IP is in the local ban list. |
| `verifyCsrfCookie` | Validates `__Host-csrf` vs header. |
| `generateCsrfCookie` | Sets the `__Host-csrf` cookie. |
| `limitBytes` | Prevents DoS by limiting request body size. |
| `contentType` | Enforces specific Content-Types. |

#### Cookies & Cryptography
*Files: `cookies`, `signing`, `b64`*
[**View Docs →**](docs/utilities/cookies.md)

| Export | Description |
| :--- | :--- |
| `makeCookie` | Helper to set `Set-Cookie` headers with defaults. |
| `createSignedValue` | Signs a string using `cryptoCookiesSecret`. |
| `verifySignedValue` | Verifies a signed string. |
| `toB64` / `fromB64` | URL-safe Base64 en/decoding. |

#### Server-to-Server
*Files: `fetch`, `agents`, `urls`*
[**View Docs →**](docs/utilities/server-to-server.md)

| Export | Description |
| :--- | :--- |
| `serviceToService` | **Important**. Secured fetch wrapper for calling Auth Service. |
| `getAuthAgent` | Returns an `undici` Dispatcher (with custom certs if configured). |
| `getBaseUrl` | Resolves the upstream Auth Service URL. |

#### OpenID Connect (OIDC) & PKCE
*Files: `oidc`, `pkce`, `oauth-tokens`*
[**View Docs →**](docs/utilities/oidc.md)

| Export | Description |
| :--- | :--- |
| `discoverOidc` | Fetches `.well-known/openid-configuration`. |
| `makePkcePair` | Generates `code_verifier` and `code_challenge`. |
| `verifyOAuthToken` | Validates a JWT ID Token signature. |
| `atHashCheck` | Validates `at_hash` claim in ID Token. |

#### Logging
*Files: `logger`, `telegram`*
[**View Docs →**](docs/utilities/logging.md)

| Export | Description |
| :--- | :--- |
| `getLogger` | Returns the global Pino instance. |
| `httpLogger` | Middleware that logs every HTTP request. |
| `sendTelegramMessage` | Sends an alert to the configured Telegam chat. |

#### Helpers & Data
*Files: `merge`, `cache`, `parsing`*
[**View Docs →**](docs/utilities/helpers.md)

| Export | Description |
| :--- | :--- |
| `MiniCache` | In-memory TTL cache class. |
| `safeObjectMerge` | Deep merges objects without prototype pollution. |
| `parseResponseContentType`| Safe parsing of JSON/Text responses. |

---

## Installation

```bash
npm install auth-h3client
```

## Troubleshooting

### 1. `401 Unauthorized` Loops
**Cause**: The client is trying to fetch data but the Refresh Token (`session` cookie) is missing or expired.
**Fix**:
- Check `docs/client.md`. Ensure you await `useAuthData()` before rendering.
- Check if your browser blocked Third-Party Cookies (if dev env is cross-domain).

### 2. `403 Forbidden` on POST
**Cause**: Missing CSRF Token.
**Fix**:
- Ensure the header `X-CSRF-Token` is set to `getCsrfToken()`.
- If using `ofetch`, wrap it or use the examples in `docs/client.md`.

### 3. "Self Signed Certificate" Error
**Cause**: Connecting to local Auth Service using self-signed certs.
**Fix**:
- Set `server.ssl.enableSSL: false` in `server/plugins/auth.ts` OR
- Provide valid CA paths in `server.ssl`.

### 4. "Upstream Connection Failed"
**Cause**: The H3 server cannot reach the Auth Service.
**Fix**:
- Check `auth_location` config.
- Verify firewalls/ports (default 4000).
