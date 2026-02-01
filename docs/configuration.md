# Configuration Guide

The `auth-h3client` library requires configuration at startup to know how to connect to your Auth Service, how to handle security, and where to redirect users.

This guide explains every configuration option available.

> [!TIP]
> **Using the Nuxt Module?** See [Nuxt Module](./module.md) for the recommended setup pattern using `defineAuthConfiguration()`.

## Initialization

> [!TIP]
> **Quick Start:** Instead of configuring everything manually, use the pre-built templates:
> ```typescript
> import { configDefaults } from 'auth-h3client/server/templates';
> defineAuthConfiguration(nitroApp, { ...configDefaults, /* overrides */ });
> ```
> See [Config Templates](./module.md#using-config-templates-recommended) for details.

You must call the `configuration()` function **exactly once** when your server starts (e.g., in a Nuxt plugin or server entry file).

```ts
import { configuration } from 'auth-h3client';

configuration({
  // ... options
});
```

---

## Server Settings (`server`)

This section controls how the client connects to your upstream Auth Service.

```ts
server: {
  auth_location: {
    serverOrDNS: 'auth-service.local', // Hostname or IP of auth service
    port: 3000                         // Port of auth service
  },
  
  // ... other server settings
}
```

### HMAC Signatures (`hmac`)

Requests to the Auth Service can be signed with HMAC to prove they come from a trusted client.

**Enabled:**
```ts
hmac: {
  enableHmac: true,
  clientId: 'my-client-id',       // Must match auth service config
  sharedSecret: 'my-super-secret' // Must match auth service config
}
```

**Disabled:**
```ts
hmac: {
  enableHmac: false
}
```

### Mutual TLS (`ssl`)

For high security, you can require mutual TLS (mTLS) authentication between this client and the Auth Service.

**Enabled:**
```ts
ssl: {
  enableSSL: true,
  mainDirPath: '/etc/ssl',          // Base directory for certs
  rootCertsPath: 'rootCA.pem',      // Root CA filename
  clientCertsPath: 'client.crt',    // Client certificate filename
  clientKeyPath: 'client.key'       // Client private key filename
}
```

**Disabled:**
```ts
ssl: {
  enableSSL: false
}
```

### Cookie Security (`cryptoCookiesSecret`)

A generic secret used to sign client-side cookies (like CSRF and OAuth state cookies) to prevent tampering.

```ts
cryptoCookiesSecret: 'long-random-string-at-least-32-chars'
```

---

## Storage Settings (`uStorage`)

Configuration for caching user authentication data. Required by authentication handlers.

```ts
import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';

// Or use any unstorage driver: redis, cloudflare-kv, etc.
const storage = createStorage({ driver: memoryDriver() });

configuration({
  // ... other options
  uStorage: {
    storage: storage,
    cacheOptions: {
      successTtl: 60 * 60 * 24 * 30,  // 30 days (default)
      rateLimitTtl: 10                 // 10 seconds (default)
    }
  }
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `storage` | `Storage` | required | An [unstorage](https://unstorage.unjs.io/) instance for caching auth data |
| `cacheOptions.successTtl` | `number` | `2592000` (30 days) | TTL in seconds for successful auth cache |
| `cacheOptions.rateLimitTtl` | `number` | `10` | TTL in seconds for rate limit cache |

### Nuxt 3 Example

```ts
import { useStorage } from '#imports';

configuration({
  uStorage: {
    storage: useStorage('cache'),  // Uses Nitro's built-in cache storage
    cacheOptions: {
      successTtl: 60 * 60 * 24,    // 1 day
      rateLimitTtl: 10
    }
  }
});
```

---

## Redirects (`onSuccessRedirect`)

The default URL where users are redirected after a successful login or signup flow if no specific redirect was requested.

```ts
onSuccessRedirect: 'https://myapp.com/dashboard'
```

---

## OAuth Providers (`OAuthProviders`)

An array of providers. Supports two types: `oidc` (OpenID Connect) and generic `oauth`.

### Type 1: OpenID Connect (`oidc`)

Use this for modern providers like Google, Auth0, Okta, etc. that support auto-discovery.

```ts
{
  kind: 'oidc',
  name: 'google',                         // Route becomes /auth/oauth/google
  issuer: 'https://accounts.google.com',  // Discovery URL
  clientId: '...',
  clientSecret: '...',
  redirectUri: 'https://myapp.com/auth/oauth/google/callback',
  supportPKCE: true,                      // Highly recommended
  redirectUrlOnSuccess: 'https://myapp.com/dashboard',
  redirectUrlOnError: 'https://myapp.com/login?error=oauth',
  
  // Optional
  defaultScopes: ['openid', 'email', 'profile'],
  extraAuthParams: { prompt: 'select_account' }
}
```

### Type 2: Generic OAuth (`oauth`)

Use this for providers like GitHub or Facebook that might not strictly follow OIDC discovery.

```ts
{
  kind: 'oauth',
  name: 'github',
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  userInfoEndpoint: 'https://api.github.com/user',
  clientId: '...',
  clientSecret: '...',
  redirectUri: 'https://myapp.com/auth/oauth/github/callback',
  supportPKCE: true,
  redirectUrlOnSuccess: 'https://myapp.com/dashboard',
  redirectUrlOnError: 'https://myapp.com/login',
  
  // Callbacks for fetching/normalizing user data
  emailCallBack: async (accessToken) => {
    // Fetch email if not in profile
    return 'user@example.com';
  },
  extraUserInfoCallBacks: [
    async (accessToken) => {
      // Fetch extra data to merge into session
      return { company: 'Acme' };
    }
  ]
}
```

---

## Telegram Logging (`telegram`)

Send security alerts (like successful logins, bans, etc.) to a Telegram chat.

**Enabled:**
```ts
telegram: {
  enableTelegramLogger: true,
  token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',  // Bot token
  chatId: '-1001234567890',                           // Chat ID
  allowedUser: 'my_telegram_username'                 // User whitelist
}
```

**Disabled:**
```ts
telegram: {
  enableTelegramLogger: false
}
```

---

## Logging Level (`logLevel`)

Controls the verbosity of the internal logger (Pino).

```ts
logLevel: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
```

---

## Firewall (`enableFireWallBans`)

Enables the library to actively ban malicious IP addresses using the server's firewall (UFW).

> [!CAUTION]
> **System Requirement:** This feature requires `ufw` to be installed and the Node.js process to have permissions to execute `sudo ufw insert ...`.
> Use with caution as it modifies system firewall rules.
> 
> **Serverless / Edge Compatibility:**  
> If deploying to **Vercel, Netlify, Cloudflare Workers, or AWS Lambda**, you **MUST** set `enableFireWallBans: false`. These environments do not provide access to system-level firewalls.

```ts
enableFireWallBans: true
```

---

## Complete Example

Here is a full configuration file you can adapt.

`config/auth.ts`:

```ts
import { configuration } from 'auth-h3client';
import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';

const storage = createStorage({ driver: memoryDriver() });

export const setupAuth = () => {
    configuration({
        server: {
            auth_location: {
                serverOrDNS: process.env.AUTH_HOST || 'localhost',
                port: Number(process.env.AUTH_PORT) || 4000
            },
            hmac: {
                enableHmac: true,
                clientId: process.env.AUTH_CLIENT_ID!,
                sharedSecret: process.env.AUTH_SHARED_SECRET!
            },
            ssl: {
                enableSSL: false
            },
            cryptoCookiesSecret: process.env.AUTH_COOKIE_SECRET!
        },
        
        uStorage: {
            storage: storage,
            cacheOptions: {
                successTtl: 60 * 60 * 24 * 30,  // 30 days
                rateLimitTtl: 10
            }
        },
        
        onSuccessRedirect: 'http://localhost:3000/dashboard',
        enableFireWallBans: true,
        logLevel: 'debug',
        
        telegram: {
            enableTelegramLogger: false
        },
        
        OAuthProviders: [
            {
                kind: 'oidc',
                name: 'google',
                issuer: 'https://accounts.google.com',
                clientId: process.env.GOOGLE_CLIENT_ID!,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
                redirectUri: 'http://localhost:3000/auth/oauth/google/callback',
                redirectUrlOnSuccess: 'http://localhost:3000/dashboard',
                redirectUrlOnError: 'http://localhost:3000/login',
                supportPKCE: true,
                defaultScopes: ['openid', 'email', 'profile']
            }
        ]
    });
};
```

Using it in Nuxt 3 (`server/plugins/auth.ts`):

```ts
import { setupAuth } from '../../config/auth';

export default defineNitroPlugin(() => {
    setupAuth();
});
```
