# Nuxt Configuration Templates

The library provides starter configuration templates to get you up and running quickly with sensible defaults for security and storage.

## Usage

1. Copy one of the templates below into a file (e.g., `server/utils/auth.config.ts`).
2. Import it in your `server/api/auth/[...].ts` handler.

```typescript
// server/api/auth/[...].ts
import { defineAuthConfiguration } from 'auth-h3client/v2';
import { configDefaults } from '~/server/utils/auth.config';

defineAuthConfiguration(configDefaults);
```

---

## Basic Configuration (Email/Password)

Best for applications that only require simple email/password authentication without external providers.

<details open>
<summary><strong>View Basic Template</strong></summary>

```typescript
// server/utils/auth.config.ts
import type { Configuration } from "auth-h3client/v2";
import { useStorage } from "nitropack/runtime/storage";
import crypto from 'node:crypto';

const random = () => crypto.randomBytes(32).toString('hex');
const required = (name: string) => { throw new Error(`Missing: ${name}`); };

export const configDefaults: Configuration = {
    server: {
        auth_location: {
            serverOrDNS: process.env.AUTH_SERVER_LOCATION || required('AUTH_SERVER_LOCATION'),
            port: Number(process.env.AUTH_PORT_LOCATION || required('AUTH_PORT_LOCATION'))
        },
        hmac: {
            enableHmac: true,
            clientId: process.env.HMAC_CLIENT_ID ?? random(),
            sharedSecret: process.env.HMAC_SHARED_SECRET ?? random(),
        },
        ssl: { enableSSL: false },
        cryptoCookiesSecret: process.env.AUTH_CRYPTO_COOKIES ?? random(),
    },
    uStorage: {
        storage: useStorage('cache'),
        cacheOptions: { successTtl: 60 * 60 * 24 * 30 }
    },
    onSuccessRedirect: `/`,
    enableFireWallBans: false,
    logLevel: 'info'
}
```
</details>

---

## Full Configuration (With OAuth)

Includes pre-wired configurations for Google, GitHub, X (Twitter), and LinkedIn.

<details>
<summary><strong>View OAuth Template</strong></summary>

```typescript
// server/utils/auth.config.ts
import type { Configuration } from "auth-h3client/v2";
import { useStorage } from "nitropack/runtime/storage";
import crypto from 'node:crypto';
// import { githubEmailCallBack } from "./callbacks/github";

const random = () => crypto.randomBytes(32).toString('hex');
const required = (name: string) => { throw new Error(`Missing: ${name}`); };

export const configDefaults: Configuration = {
    server: {
        auth_location: {
            serverOrDNS: process.env.AUTH_SERVER_LOCATION || required('AUTH_SERVER_LOCATION'),
            port: Number(process.env.AUTH_PORT_LOCATION || required('AUTH_PORT_LOCATION'))
        },
        hmac: {
            enableHmac: true,
            clientId: process.env.HMAC_CLIENT_ID ?? random(),
            sharedSecret: process.env.HMAC_SHARED_SECRET ?? random(),
        },
        ssl: { enableSSL: false },
        cryptoCookiesSecret: process.env.AUTH_CRYPTO_COOKIES ?? random(),
    },
    uStorage: {
        storage: useStorage('cache'),
        cacheOptions: { successTtl: 60 * 60 * 24 * 30 }
    },
    onSuccessRedirect: `/`,
    enableFireWallBans: false,
    logLevel: 'info',
    OAuthProviders: [
        {
            kind: 'oidc',
            name: 'google',
            issuer: 'https://accounts.google.com',
            clientId: process.env.OAUTH_GOOGLE_CLIENT_ID!,
            clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET!,
            redirectUri: `${process.env.BASEURL}/oauth/callback/google`,
            supportPKCE: true,
            defaultScopes: ["openid", "email", "profile"]
        },
        {
            kind: 'oauth',
            name: 'github',
            authorizationEndpoint: 'https://github.com/login/oauth/authorize',
            tokenEndpoint: 'https://github.com/login/oauth/access_token',
            userInfoEndpoint: 'https://api.github.com/user',
            clientId: process.env.OAUTH_GITHUB_CLIENT_ID!,
            clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET!,
            redirectUri: `${process.env.BASEURL}/oauth/callback/github`,
            defaultScopes: ['read:user', 'user:email'],
            supportPKCE: true
        }
    ]
}
```
</details>
