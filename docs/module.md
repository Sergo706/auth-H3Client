# Nuxt Module

The `auth-h3client` library handles authentication for Nuxt 3+ applications. It provides a module that auto-imports client-side composables and server-side utilities, plus optional security middleware.

## Installation

```bash
npm install auth-h3client
```

## Prerequisites

**This module is a Client SDK.**
It requires a running instance of the [**Auth Service**](https://github.com/Sergo706/auth) to connect to. It *does not* store users or passwords itself. It proxies requests to your backend Auth Service.

## Quick Start

### 1. Register the Module

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['auth-h3client/module'],
  authH3Client: {
    enableMiddleware: true // Enables CSRF, bot detection, IP validation middleware
  }
})
```

### 2. Create a Server Plugin

The module does **not** auto-configure the auth library because configuration includes non-serializable options (storage instances, callbacks). You must create a server plugin:

```typescript
// server/plugins/auth.ts
import { defineAuthConfiguration } from 'auth-h3client/v1'
import { defineNitroPlugin, useStorage } from 'nitropack/runtime'

export default defineNitroPlugin((nitroApp) => {
  defineAuthConfiguration(nitroApp, {
    server: {
      auth_location: { serverOrDNS: 'localhost', port: 4000 },
      hmac: { enableHmac: false },
      ssl: { enableSSL: false },
      cryptoCookiesSecret: 'dev-secret-minimum-32-characters-long-string-here'
    },
    uStorage: {
      storage: useStorage('cache'),
      cacheOptions: {
        successTtl: 60 * 60 * 24 * 30,
        rateLimitTtl: 10
      }
    },
    onSuccessRedirect: '/dashboard',
    enableFireWallBans: false,
    logLevel: 'debug',
    
    // Optional: OAuth Providers
    OAuthProviders: [
      {
        kind: 'oidc',
        name: 'google',
        issuer: 'https://accounts.google.com',
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: 'http://localhost:3000/auth/oauth/google/callback',
        redirectUrlOnSuccess: '/dashboard',
        redirectUrlOnError: '/login',
        supportPKCE: true,
        defaultScopes: ['openid', 'email', 'profile']
      }
    ]
  })
})
```

> [!NOTE]
> For a detailed explanation of every configuration field, see the [Configuration Guide](./configuration.md).

### Using Config Templates (Recommended)

Instead of writing all configuration from scratch, use the provided templates as a base and override what you need:

```typescript
// server/plugins/auth.ts
import { defineNitroPlugin } from 'nitropack/runtime/plugin';
import { useStorage } from 'nitropack/runtime/storage';
import { configDefaults } from 'auth-h3client/server/templates';
import { defineAuthConfiguration } from 'auth-h3client/v1';

export default defineNitroPlugin((nitroApp) => {
  defineAuthConfiguration(nitroApp, {
    ...configDefaults,
    // Override what you need:
    onSuccessRedirect: '/dashboard',
    uStorage: {
      storage: useStorage('cache'),
      cacheOptions: { successTtl: 60 * 60 * 24 * 7, rateLimitTtl: 10 }
    }
  });
});
```

**Available Templates:**

| Import | Description |
|--------|-------------|
| `configDefaults` | Basic config with HMAC, storage, and standard settings |
| `configDefaultsWithOAuth` | Includes pre-configured Google, GitHub, X, and LinkedIn providers |

The templates read from environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SERVER_LOCATION` | Yes | Hostname of your Auth Service |
| `AUTH_PORT_LOCATION` | Yes | Port of your Auth Service |
| `HMAC_CLIENT_ID` | No | Auto-generated if not set |
| `HMAC_SHARED_SECRET` | No | Auto-generated if not set |
| `AUTH_CRYPTO_COOKIES` | No | Auto-generated if not set |

For `configDefaultsWithOAuth`, you also need:
- `BASEURL` - Your app's base URL (e.g., `https://myapp.com`)
- `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`
- `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET`
- `OAUTH_X_CLIENT_ID`, `OAUTH_X_CLIENT_SECRET`
- `OAUTH_LINKEDIN_CLIENT_ID`, `OAUTH_LINKEDIN_CLIENT_SECRET`

## Module Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableMiddleware` | `boolean` | `true` | Enables global security middleware (CSRF, bot detection, IP validation) |

> [!WARNING]
> **Serverless / Edge Compatibility**
> If deploying to **Vercel, Netlify, Cloudflare Workers, or AWS Lambda**, you **MUST** set `enableFireWallBans: false` in your plugin config.
> The firewall feature relies on `sudo ufw` which is only available on VPS/Dedicated servers.

## Deployment & Serverless

> [!WARNING]
> **Serverless / Edge Compatibility**
> If deploying to **Vercel, Netlify, Cloudflare Workers, or AWS Lambda**, you **MUST** set `enableFireWallBans: false`.
>
> The firewall feature relies on `sudo ufw` which is only available on VPS/Dedicated servers (DigitalOcean Droplets, AWS EC2, Hetzner, etc.). Enabling it in a serverless environment will cause the application to crash or error on startup.

## Client-Side Composables

The module auto-imports these utilities. You do NOT need to import them manually.

### `useAuthData`

A reactive, singleton composable that returns the current user's authentication state. It checks the `/auth/users/authStatus` endpoint (or your custom URL) once and caches the result.

**Usage:**
```vue
<script setup>
// Auto-imported by Nuxt
const auth = await useAuthData();

// auth.value is type AuthState:
// {
//   authorized: boolean;
//   id?: string;
//   mfaRequired: boolean;
//   message?: string;
// }

if (auth.value.authorized) {
    console.log('User ID:', auth.value.id);
}
</script>
```

### `getCsrfToken()`

Synchronously retrieves the current CSRF token from the browser cookie. Useful for adding the `X-CSRF-Token` header to manual fetch requests.

**Usage:**
```typescript
const token = getCsrfToken();
// Use in headers: { 'X-CSRF-Token': token }
```

### `executeRequest<T>()`

A universal fetch wrapper that handles CSRF injection, header proxying, and cookie propagation between server and client.

**Usage:**
```typescript
const result = await executeRequest<{ user: User }>('/api/profile', 'GET');
if (result.ok) {
  console.log(result.data.user);
}
```

> [!TIP]
> **Advanced Patterns**: For detailed API reference and usage patterns, read the [Client-Side Guide](./client.md).

## Server-Side Integrations

The module deeply integrates with Nuxt's Nitro server.

### 1. Global Middleware
If `enableMiddleware` is `true` (default), the module registers a global server middleware that runs on every request:

*   **IP Validation**: Checks if the IP is banned (if `enableFireWallBans` is true) or malformed.
*   **Bot Detection**: Runs `botDetectorMiddleware` to block basic bot signatures.
*   **CSRF Generation**: Sets the CSRF cookie if missing.
*   **Security Headers**: Applies default security headers.

> **Note**: Middleware treats requests from `localhost` (`127.0.0.1`, `::1`) as trusted and bypasses stricter checks.

> [!INFO]
> For more details on these security mechanisms, see [CSRF & Visitor Protection](./csrf-and-visitor.md).

### 2. Auto-Imported Server Utilities
Over 50 utilities from the core library are auto-imported into your `server/` directory.

### 3. API Routes & Prefixes
The module automatically registers the following routes. Note the mixed prefix strategy:

| Route | Method | Description |
| :--- | :--- | :--- |
| `/login` | POST | User login |
| `/signup` | POST | User registration |
| `/logout` | POST | User logout |
| `/api/auth/verify-mfa/:visitor` | GET/POST | MFA verification (Magic Link) |
| `/api/auth/password-reset` | POST | Request password reset |
| `/api/auth/reset-password/:visitor` | GET/POST | Reset password with token |
| `/auth/oauth/:provider` | GET | OAuth start (e.g. `/auth/oauth/google`) |
| `/auth/oauth/:provider/callback` | GET | OAuth callback |

**Why the mix?**
* **Core Auth** (`/login`, `/signup`) lives at the root for standard form compatibility.
* **Flows** (`/api/...`) are prefixed to avoid collisions with your pages.

### 4. Code Examples

**Commonly Used Imports:**

*   **Middleware wrappers**: `defineAuthenticatedEventHandler`, `defineOptionalAuthenticationEvent`
*   **Guards**: `ensureValidCredentials`, `ensureAccessToken`, `verifyCsrfCookie`
*   **Auth Handlers**: `loginHandler`, `signUpHandler`, `handleLogout`
*   **Utils**: `getCachedUserData`, `makeCookie`, `createSignedValue`

**Example: Protected Server API Route**

```typescript
// server/api/secret-data.ts
// defineAuthenticatedEventHandler is auto-imported! 
// It automatically checks for valid tokens before running your handler.
export default defineAuthenticatedEventHandler(async (event) => {
    // If we get here, the user is authenticated.
    
    // getCachedUserData is auto-imported!
    const user = await getCachedUserData(event);
    
    return {
        secret: 'data',
        userId: user.id
    };
});
```

## Further Reading

*   [Configuration Guide](./configuration.md) - Deep dive into all configuration options.
*   [Client-Side Strategy](./client.md) - Best practices for frontend authentication state.
*   [OAuth Providers](./oauth.md) - Setting up Google, GitHub, and custom providers.
*   [Routes & Controllers](./routes-and-controllers.md) - Understanding the backend authentication flow.
