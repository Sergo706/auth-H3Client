# Nuxt Module and Server Configuration

This document serves as the comprehensive reference for integrating `auth-h3client` with Nuxt 3 and Nitro. It details the module's "Auto-Wiring" mechanics and provides an exhaustive dictionary of all configuration options.

## 1. The Nuxt Module (`auth-h3client/module`)

The Nuxt module is a build-time tool that orchestrates the integration. It does NOT hold runtime secrets.

### Installation

```bash
npm install auth-h3client
```

### Module Configuration (`nuxt.config.ts`)

These options affect the *build* and *server startup* phase, enabling or disabling broad feature sets.

```typescript
export default defineNuxtConfig({
  modules: ['auth-h3client/module'],
  authH3Client: {
    // Toggles the global middleware injection.
    // If false, you must manually register the middleware in server/middleware/
    enableMiddleware: true
  }
})
```

### Auto-Wiring Mechanics

What does the module actually do?

1.  **Server Imports**: It scans `auth-h3client/v1` (or v2) and auto-imports ~50 utilities (e.g., `defineAuthenticatedEventHandler`, `useAuthData`, `lockAsyncAction`) into your `server/` directory. This means you never need to write `import { ... } from 'auth-h3client/v1'` in your server files.
2.  **Client Imports**: It auto-imports `useAuthData` and `getCsrfToken` into your Vue components.
3.  **Global Middleware**: If `enableMiddleware` is true, it injects the library's main middleware handler into the Nitro server pipeline. This handler performs:
    -   **CSRF Token Generation**: Sets `__Host-csrf` if missing.
    -   **Bot Detection**: Calls the upstream `/check` endpoint.
    -   **IP Validation**: Checks for bans.
4.  **Route Registration**: It automatically mounts a set of API routes to handle authentication flows (Login, Signup, OAuth, etc.).

---

## 2. Server Runtime Configuration (`defineAuthConfiguration`)

All operational settings, secrets, and provider details must be defined in a **Nitro Plugin**. This ensures they are available at runtime and not baked into the client bundle.

### Setup

Create a file at `server/plugins/auth.ts`:

```typescript
import { defineAuthConfiguration } from 'auth-h3client/v1';
import { defineNitroPlugin, useStorage } from 'nitropack/runtime';

export default defineNitroPlugin((nitroApp) => {
  defineAuthConfiguration(nitroApp, {
     // ... properties ...
  });
});
```

### Configuration Schema Reference

The configuration object is validated at runtime using `zod`. Invalid configuration will cause the server to crash on startup (Fail Fast).

#### 2.1 Server Connection (`server`)

Settings for connecting to the upstream Auth Service.

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `auth_location` | `Object` | **Yes** | Destination of the Auth Service. |
| `auth_location.serverOrDNS` | `string` | Yes | Hostname (e.g., `localhost` or `auth.internal`). |
| `auth_location.port` | `number` | Yes | Port number (e.g., `4000`). |
| `cryptoCookiesSecret` | `string` | **Yes** | A 32+ char secret used to sign CSRF and State cookies. |
| `hmac` | `Object` | **Yes** | HMAC Request Signing settings. |
| `ssl` | `Object` | **Yes** | mTLS settings. |

**HMAC Options (`server.hmac`)**

| Mode | Fields | Description |
| :--- | :--- | :--- |
| **Disabled** | `{ enableHmac: false }` | No signing. |
| **Enabled** | `{ enableHmac: true, clientId: string, sharedSecret: string }` | Signs requests. `clientId` identifies this client to the Auth Service. |

**SSL Options (`server.ssl`)**

| Mode | Fields | Description |
| :--- | :--- | :--- |
| **Disabled** | `{ enableSSL: false }` | Valid for internal networks or HTTPs proxies. |
| **Enabled** | `{ enableSSL: true, mainDirPath: string, rootCertsPath: string, clientCertsPath: string, clientKeyPath: string }` | Full mTLS paths. |

#### 2.2 Storage & Caching (`uStorage`)

The library requires a storage driver (via `unstorage`) to cache User Metadata and Session info.

| Property | Type | Description |
| :--- | :--- | :--- |
| `storage` | `Storage` | An initialized `unstorage` instance. |
| `cacheOptions` | `Object` | (Optional) TTL settings. |
| `cacheOptions.successTtl` | `number` | Time (ms) to cache valid user data. Default: 30 days. |
| `cacheOptions.rateLimitTtl` | `number` | Time (ms) to remember rate-limit hits. Default: 10s. |

#### 2.3 General Options

| Property | Type | Description |
| :--- | :--- | :--- |
| `onSuccessRedirect` | `string` | **Yes.** URL path to redirect after successful Login/Signup (e.g., `/dashboard`). |
| `logLevel` | `'debug' \| 'info' \| 'warn' ...` | **Yes.** Logging verbosity. |
| `enableFireWallBans` | `boolean` | **Yes.** If `true`, instructs the Upstream Auth Service to ban malicious IPs via UFW. **Warning**: Upstream service must be configured for this. |

#### 2.4 Telegram Logger (`telegram`)

Optional security alerts sent to Telegram.

| Mode | Fields |
| :--- | :--- |
| **Disabled** | `{ enableTelegramLogger: false }` |
| **Enabled** | `{ enableTelegramLogger: true, token: string, chatId: string, allowedUser: string }` |

#### 2.5 OAuth Providers (`OAuthProviders`)

An array of provider configurations. Supports both `oidc` (OpenID Connect) and generic `oauth`.

**Common Fields**

| Property | Description |
| :--- | :--- |
| `name` | Used in URLs (e.g., `/auth/oauth/google`). |
| `clientId` | Provider Client ID. |
| `clientSecret` | Provider Client Secret. |
| `redirectUri` | Must match what is registered with the provider. |
| `redirectUrlOnSuccess` | Where to go after success. |
| `redirectUrlOnError` | Where to go after failure. |
| `supportPKCE` | `boolean`. Usually `true` for modern flows. |
| `defaultScopes` | `string[]`. Scopes to request (e.g., `['email', 'profile']`). |

**Type: OIDC (`kind: 'oidc'`)**

| Property | Description |
| :--- | :--- |
| `issuer` | Discovery URL (e.g., `https://accounts.google.com`). |

**Type: OAuth (`kind: 'oauth'`)**

| Property | Description |
| :--- | :--- |
| `authorizationEndpoint` | URL for the auth dialog. |
| `tokenEndpoint` | URL to exchange code for token. |
| `userInfoEndpoint` | URL to fetch user details. |
| `emailCallBack` | `(token) => Promise<string>`. Custom function to fetch email if standard flow fails. |
