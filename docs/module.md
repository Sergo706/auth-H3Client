# Nuxt Module

The `auth-h3client` library handles authentication for Nuxt 3+ applications. It provides a drop-in module that handles server-side security middleware, API route registration, and client-side state management.

## Installation

```bash
npm install auth-h3client
```

## Configuration

The module must be configured in `nuxt.config.ts` under the `authH3Client` key. The configuration structure strictly mirrors the [Library Configuration](./configuration.md), with one major exception: **server-side storage (`uStorage`) is handled automatically by the module using Nuxt's Nitro storage**.

### Example `nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  modules: ['auth-h3client/module'],

  authH3Client: {
    // 1. Module Options
    // Enable global middleware for CSRF, Bot Detection, and IP Validation (default: true)
    enableMiddleware: true,

    // 2. Server Connection Config (Required)
    server: {
      auth_location: {
        serverOrDNS: process.env.AUTH_HOST || 'auth-service',
        port: parseInt(process.env.AUTH_PORT || '4000')
      },
      // HMAC Signing (Required)
      hmac: {
        enableHmac: true,
        clientId: process.env.AUTH_CLIENT_ID || 'client-id',
        sharedSecret: process.env.AUTH_SHARED_SECRET || 'secret'
      },
      // SSL Config (Required)
      ssl: {
        enableSSL: false 
      },
      // Secret for signing cookies (Required, min 32 chars)
      cryptoCookiesSecret: process.env.AUTH_COOKIE_SECRET || 'CHANGE_ME_TO_A_VERY_LONG_RANDOM_STRING'
    },

    // 3. User Redirection (Required)
    onSuccessRedirect: '/dashboard',

    // 4. Security Settings (Required)
    enableFireWallBans: true, // Respect bans from auth service
    
    // 5. Logging (Required)
    logLevel: 'debug', // 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    
    telegram: {
        enableTelegramLogger: false
    },

    // 6. OAuth Providers (Optional)
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
  }
})
```

> [!NOTE]
> For a detailed explanation of every configuration field, please refer to the [Configuration Guide](./configuration.md).

## Client-Side Composables

The module auto-imports these composables. You do NOT need to import them manually.

### `useAuthData`

A reactive, singleton composable that returns the current user's authentication state. It checks the `/users/authStatus` endpoint (or your custom URL) once and caches the result.

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

### `AuthBase`

A base class that wraps `useAuthData`. Useful if you are building class-based services or stores.

> [!TIP]
> **Advanced Patterns**: For detailed strategies on avoiding token race conditions, "Fail Fast" optimizations, and advanced `AuthBase` usage, read the [Client-Side Guide](./client.md).

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
