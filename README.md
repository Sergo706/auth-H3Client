# auth-H3Client

H3 middleware, controllers, and utilities for integrating the front-end gateway with the [`auth`](https://github.com/Sergo706/auth) service. Pairing this package with an `auth` service instance (using its default or custom configuration) gives you end-to-end authentication flows with minimal wiring. H3 is used here to keep the edge gateway adaptable across environments, while the `auth` service itself runs on Express/Node.

## Features

- **Drop-in routes**: `useAuthRoutes`, `magicLinksRouter`, and `useOAuthRoutes` register login, signup, MFA, reset-password, and OAuth flows on any H3 router.
- **Middlewares**: CSRF issuance/verification, body size limiting, visitor fingerprint validation, token rotation, structured logging, and more.
- **Typed utilities**: Cookie helpers, PKCE generation, OAuth token verification, server-to-server fetch wrapper, Telegram logging, and mini cache implementation.
- **Config-driven**: Strongly typed configuration schema validated via `zod`, with optional OAuth provider metadata, HMAC signing, and TLS options.

## Installation

```bash
npm install auth-h3client
# or
yarn add auth-h3client
```

## Nuxt 3+ Module

If you are using **Nuxt 3++**, use the dedicated module. It handles all configuration, middleware, and auto-imports for you.

1. Install:
   ```bash
   npm install auth-h3client
   ```
2. Add to `nuxt.config.ts`:
   ```ts
   modules: ['auth-h3client/module'],
   ```
3. Read the [Nuxt Module Documentation](docs/module.md) for full configuration and usage.

### H3 v1 vs v2

This package supports both H3 v1 and H3 v2. Choose the matching entry point for your H3 version:

- H3 v1 (default): import from `auth-h3client` or `auth-h3client/v1` (peer: `h3@^1.15.4`).
- H3 v2: import from `auth-h3client/v2` (peer: `h3@^2.0.0-beta.4`).
- Client: import from `auth-h3client/client` for Nuxt/Vue composables (peer: `nuxt`, `vue`, `ofetch`).

Quick wiring examples:

- H3 v1
  ```ts
  import { createApp, createRouter } from 'h3'
  import { configuration, httpLogger, isIPValid, botDetectorMiddleware, generateCsrfCookie, useAuthRoutes, magicLinksRouter, useOAuthRoutes } from 'auth-h3client/v1'
  configuration({ /* ... */ })
  const app = createApp()
  httpLogger()(app)
  app.use(isIPValid)
  app.use(botDetectorMiddleware)
  app.use(generateCsrfCookie)
  const router = createRouter()
  useAuthRoutes(router); magicLinksRouter(router); useOAuthRoutes(router)
  app.use(router)
  ```

- H3 v2
  ```ts
  import { createApp, createRouter } from 'h3'
  import { configuration, httpLogger, isIPValid, botDetectorMiddleware, generateCsrfCookie, useAuthRoutes, magicLinksRouter, useOAuthRoutes } from 'auth-h3client/v2'
  configuration({ /* ... */ })
  const app = createApp()
  app.use(httpLogger)
  app.use(isIPValid)
  app.use(botDetectorMiddleware)
  app.use(generateCsrfCookie)
  const router = createRouter()
  useAuthRoutes(router); magicLinksRouter(router); useOAuthRoutes(router)
  app.use(router)
  ```

See docs/h3-v1-v2.md for more details, including route-level middleware and handler differences.

## Configuring the Library

Before using any exported handlers you must call the `configuration` function exactly once at boot. The settings mirror `Configuration` from `src/types/configSchema.ts`.

```ts
import { configuration } from 'auth-h3client';
import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';

const storage = createStorage({ driver: memoryDriver() });

configuration({
  server: {
    auth_location: {
      serverOrDNS: process.env.AUTH_API_HOST ?? '127.0.0.1',
      port: Number(process.env.AUTH_API_PORT ?? 10000),
    },
    hmac: {
      enableHmac: true,
      clientId: process.env.AUTH_CLIENT_ID!,
      sharedSecret: process.env.AUTH_SHARED_SECRET!,
    },
    ssl: {
      enableSSL: false,
    },
    cryptoCookiesSecret: process.env.COOKIE_SECRET!,
  },
  uStorage: {
    storage: storage,
    cacheOptions: {
      successTtl: 60 * 60 * 24 * 30,  // 30 days
      rateLimitTtl: 10
    }
  },
  onSuccessRedirect: 'https://app.example.com/dashboard',
  OAuthProviders: [
    {
      kind: 'oidc',
      name: 'google',
      issuer: 'https://accounts.google.com',
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      defaultScopes: ['openid', 'email', 'profile'],
      redirectUri: 'https://app.example.com/oauth/callback/google',
      supportPKCE: true,
      redirectUrlOnSuccess: 'https://app.example.com/dashboard',
      redirectUrlOnError: 'https://app.example.com/login',
    },
  ],
  telegram: { enableTelegramLogger: false },
  logLevel: 'info',
});
```

### Providers quick reference

You can mix and match both kinds under `OAuthProviders`.

OIDC provider shape (discriminated by `kind: 'oidc'`):

```ts
{
  kind: 'oidc';
  name: string;                         // short provider key used in routes
  issuer: string;                       // https://... OIDC issuer URL
  clientId: string;
  clientSecret: string;
  redirectUri: string;                  // where the provider redirects back
  supportPKCE: boolean;                 // whether to use PKCE
  redirectUrlOnSuccess: string;         // http(s)://...
  redirectUrlOnError: string;           // http(s)://...
  // optional
  defaultScopes?: string[];             // e.g. ['openid','email','profile']
  extraAuthParams?: Record<string,string>; // idp-specific extra params
  tokenAuthMethod?: 'client_secret_basic' | 'client_secret_post';
}
```

OAuth provider shape (discriminated by `kind: 'oauth'`):

```ts
{
  kind: 'oauth';
  name: string;                         // short provider key used in routes
  authorizationEndpoint: string;        // https://.../authorize
  tokenEndpoint: string;                // https://.../token
  userInfoEndpoint: string;             // https://.../userinfo
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  supportPKCE: boolean;
  redirectUrlOnSuccess: string;         // http(s)://...
  redirectUrlOnError: string;           // http(s)://...
  // optional
  defaultScopes?: string[];
  extraAuthParams?: Record<string, string>;
  tokenAuthMethod?: 'client_secret_basic' | 'client_secret_post';
  emailCallBack?: (accessToken: string) => Promise<string>; // when provider lacks email
  extraUserInfoCallBacks?: Array<(accessToken: string) => Promise<Record<string,unknown>>>; // merge extra user data
}
```

## Complete configuration example

Below is a single, complete configuration object showing all fields. Items marked as optional are not required and can be omitted.

```ts
// config/auth-client.config.ts
import type { Configuration } from 'auth-h3client/dist/types/configSchema';
import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';

const storage = createStorage({ driver: memoryDriver() });

export const config: Configuration = {
  server: {
    auth_location: {
      serverOrDNS: '127.0.0.1',
      port: 10000,
    },
    // Optional HMAC sealing – set enableHmac to false to disable
    hmac: {
      enableHmac: true,
      clientId: process.env.AUTH_CLIENT_ID!,
      sharedSecret: process.env.AUTH_SHARED_SECRET!,
    },
    // Optional mTLS – set enableSSL to false if not using client certs
    ssl: {
      enableSSL: false, // true if mutual TLS is required by your auth service
      // The following paths are required only when enableSSL is true
      // (optional when enableSSL is false)
      mainDirPath: '/etc/ssl',           // optional
      rootCertsPath: 'rootCA.pem',       // optional
      clientCertsPath: 'client.crt',     // optional
      clientKeyPath: 'client.key',       // optional
    },
    cryptoCookiesSecret: process.env.COOKIE_SECRET!,
  },

  // Storage for caching user authentication data (required)
  uStorage: {
    storage: storage,  // any unstorage driver: memory, redis, cloudflare-kv, etc.
    cacheOptions: {
      successTtl: 60 * 60 * 24 * 30,  // 30 days
      rateLimitTtl: 10                 // 10 seconds
    }
  },

  // Where users are redirected after successful auth (used by multiple flows)
  onSuccessRedirect: 'https://app.example.com/dashboard',

  // Optional list of OAuth/OIDC providers
  OAuthProviders: [
    {
      kind: 'oidc',
      name: 'google',
      issuer: 'https://accounts.google.com',
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: 'https://app.example.com/oauth/callback/google',
      supportPKCE: true,
      redirectUrlOnSuccess: 'https://app.example.com/dashboard',
      redirectUrlOnError: 'https://app.example.com/login',
      // optional
      defaultScopes: ['openid', 'email', 'profile'],
      extraAuthParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      tokenAuthMethod: 'client_secret_basic', // optional
    },
    {
      kind: 'oauth',
      name: 'github',
      authorizationEndpoint: 'https://github.com/login/oauth/authorize',
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
      userInfoEndpoint: 'https://api.github.com/user',
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: 'https://app.example.com/oauth/callback/github',
      supportPKCE: true,
      redirectUrlOnSuccess: 'https://app.example.com/dashboard',
      redirectUrlOnError: 'https://app.example.com/login',
      // optional
      defaultScopes: ['read:user', 'user:email'],
      emailCallBack: async (accessToken) => {
        // Fetch primary email from provider API if needed
        // return string email
        return 'user@example.com';
      },
      extraUserInfoCallBacks: [
        async (accessToken) => ({ timezone: 'UTC' }),
      ],
      tokenAuthMethod: 'client_secret_post', // optional
      extraAuthParams: { include_granted_scopes: 'true' }, // optional
    },
  ],

  // Optional Telegram security notifications
  telegram: {
    enableTelegramLogger: false, // set to true to enable
    // The following are required only when enableTelegramLogger is true
    token: process.env.TELEGRAM_BOT_TOKEN!,   // optional when disabled
    chatId: process.env.TELEGRAM_CHAT_ID!,    // optional when disabled
    allowedUser: process.env.TELEGRAM_USER!,  // optional when disabled
  },

  // Logger level used by internal pino
  logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error' | 'fatal'
};
```

### Configuration cheat sheet

| Key | Description |
| --- | --- |
| `server.auth_location` | Location of the upstream auth API (host & port). |
| `server.hmac` | Enables optional HMAC sealing of outbound requests; requires client ID and shared secret. |
| `server.ssl` | TLS settings for mutual TLS connections to the auth API. When `enableSSL` is `true`, provide certificate paths. |
| `server.cryptoCookiesSecret` | Secret used to sign CSRF and state cookies. |
| `onSuccessRedirect` | Default redirect URL after successful login/signup/MFA flows. |
| `OAuthProviders` | Optional list of OAuth/OIDC providers with per-provider redirect behavior. |
| `telegram` | Optional Telegram alerting configuration for security events. |
| `logLevel` | Pino logger level (`debug`, `info`, `warn`, `error`, or `fatal`). |

See `test/setup/config.ts` for a complete example with multiple OAuth providers.

## H3 Application

The library exports controllers, middlewares, and route registrars. A typical setup looks like:

```ts
import { H3, serve } from 'h3';
import {
  configuration,
  httpLogger,
  isIPValid,
  botDetectorMiddleware,
  generateCsrfCookie,
  useAuthRoutes,
  magicLinksRouter,
  useOAuthRoutes,
} from 'auth-h3client';

configuration(/* ...config object from above... */);

const app = new H3();
app.register(httpLogger());
app.use(isIPValid);
// Wire the bot detector only if your auth service enables it (/check endpoint)
app.use(botDetectorMiddleware);
app.use(generateCsrfCookie);

useAuthRoutes(app);
magicLinksRouter(app);
useOAuthRoutes(app);

serve(app, {
  port: 3000,
  hostname: '0.0.0.0',
});
```

### Using individual controllers/middlewares

Every piece is exportable if you prefer composing your own routes:

```ts
import { defineEventHandler } from 'h3';
import {
  loginHandler,
  handleLogout,
  limitBytes,
  verifyCsrfCookie,
  ensureValidCredentials,
} from 'auth-h3client';

router.post(
  '/auth/login',
  loginHandler,
  { middleware: [verifyCsrfCookie, limitBytes(1024)] },
);

router.post(
  '/auth/logout',
  handleLogout,
  { middleware: [verifyCsrfCookie, ensureValidCredentials] },
);
```

## Running as a Standalone Instance

The repository ships with a smoke-test server under `test/server.ts`. To explore the integration end-to-end:

```bash
npm run build
node dist/test/server.js
```

Provide the configuration via `test/setup/config.ts` (environment variables for OAuth secrets, etc.). The test server exercises the default middlewares, static routes, and OAuth providers defined in that configuration.

## Utilities and Helpers

- `serviceToService` (alias of `sendToServer`): wraps `fetch` with client headers, cookies, and optional HMAC signing.
- `makeCookie`, `createSignedValue`, `verifySignedValue`: consistent cookie helpers respecting `__Host-` / `__Secure-` prefixes.
- `ensureAccessToken`, `ensureRefreshCookie`, `ensureValidCredentials`: token rotation middleware for protecting downstream routes.
- `verifyOAuthToken`, `discoverOidc`, `makePkcePair`: OAuth/OIDC support primitives.
- `MiniCache`: lightweight TTL cache useful for memoizing remote lookups.

Refer to the TSDoc comments across `src/` for parameter descriptions and usage samples.

## Further reading

- [Token rotation and metadata](docs/token-rotation.md)
- [OAuth/OIDC flow](docs/oauth.md)
- [CSRF and visitor validation](docs/csrf-and-visitor.md)
- [Routes and controllers](docs/routes-and-controllers.md)
- [Server-to-server requests](docs/server-to-server.md)
- [Logging and error handling](docs/logging-and-errors.md)
- [H3 v1 vs v2 guide](docs/h3-v1-v2.md)
- [Client package](docs/client.md) - Nuxt/Vue composables and utilities
- [Configuration guide](docs/configuration.md) - Full options reference

### Handler Wrappers

- [defineAuthenticatedEventHandler](docs/wrappers/defineAuthenticatedEventHandler.md) - Require authentication
- [defineOptionalAuthenticationEvent](docs/wrappers/defineOptionalAuth.md) - Optional authentication
- [defineAuthenticatedEventPostHandlers](docs/wrappers/authenticatedPostHandler.md) - Auth + CSRF + POST
- [defineVerifiedCsrfHandler](docs/wrappers/csrfVerifier.md) - CSRF protection
- [getAuthStatusHandler](docs/wrappers/getAuthStatus.md) - Pre-built auth status endpoint
- [getCachedUserData](docs/wrappers/getCachedUserData.md) - Low-level user data caching
- [defineDeduplicatedEventHandler](docs/wrappers/defineDeduplicatedEventHandler.md) - Request serializing/deduplication
