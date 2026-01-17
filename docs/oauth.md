# OAuth and OpenID Connect Guide

This is a comprehensive guide for configuring OAuth and OpenID Connect (OIDC) providers with `auth-h3client`. The library supports both protocols and is designed to work with 99% of identity providers.

---

## Table of Contents

1. [Overview](#overview)
2. [Provider Types](#provider-types)
3. [Configuration Reference](#configuration-reference)
4. [Email Requirements](#email-requirements)
5. [Provider-Specific Guides](#provider-specific-guides)
6. [Security Features](#security-features)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The OAuth/OIDC implementation follows the **Authorization Code Flow** with optional **PKCE** (Proof Key for Code Exchange). This is the most secure flow for server-side applications.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           OAuth Flow Diagram                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User                    Your App                   Auth Provider       │
│   │                         │                            │              │
│   │ 1. Click "Login"        │                            │              │
│   │─────────────────────────▶                            │              │
│   │                         │                            │              │
│   │ 2. Redirect to provider │                            │              │
│   │ (with state, PKCE)      │                            │              │
│   │◀────────────────────────│────────────────────────────▶              │
│   │                         │                            │              │
│   │ 3. User logs in                                      │              │
│   │─────────────────────────────────────────────────────▶│              │
│   │                         │                            │              │
│   │ 4. Redirect back to app with code                    │              │
│   │◀─────────────────────────────────────────────────────│              │
│   │                         │                            │              │
│   │                         │ 5. Exchange code for tokens│              │
│   │                         │────────────────────────────▶              │
│   │                         │                            │              │
│   │                         │ 6. Tokens + user info      │              │
│   │                         │◀───────────────────────────│              │
│   │                         │                            │              │
│   │ 7. Session created,     │                            │              │
│   │    redirect to app      │                            │              │
│   │◀────────────────────────│                            │              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Routes Created

When you call `useOAuthRoutes(app)`, these routes are registered:

| Route | Handler | Description |
|-------|---------|-------------|
| `GET /oauth/:provider` | `OAuthRedirect` | Initiates the OAuth flow |
| `GET /oauth/callback/:provider` | `OAuthCallback` | Handles the provider's callback |

---

## Provider Types

The library supports two types of providers, distinguished by the `kind` field.

### OIDC Providers (`kind: 'oidc'`)

Use for providers that support **OpenID Connect Discovery**. The library automatically fetches the provider's configuration from `/.well-known/openid-configuration`.

**Best for:**
- Google
- Microsoft / Azure AD
- Auth0
- Okta
- Keycloak
- Any provider with OIDC Discovery

**Benefits:**
- Auto-discovers authorization, token, and JWKS endpoints
- Validates `id_token` signature against JWKS
- Supports `nonce` for replay protection
- Validates `at_hash` for token binding

### OAuth Providers (`kind: 'oauth'`)

Use for providers that don't support OIDC discovery or require manual endpoint configuration.

**Best for:**
- GitHub
- Twitter/X
- LinkedIn
- Facebook
- Discord
- Slack

**Benefits:**
- Full control over endpoints
- Custom email and user info callbacks
- Works with non-standard OAuth implementations

---

## Configuration Reference

### OIDC Provider Schema

```ts
{
  kind: 'oidc',
  
  // Required
  name: string,                      // URL-safe name (e.g., 'google', 'azure')
  issuer: string,                    // OIDC issuer URL (e.g., 'https://accounts.google.com')
  clientId: string,                  // OAuth client ID
  clientSecret: string,              // OAuth client secret
  redirectUri: string,               // Your callback URL
  supportPKCE: boolean,              // Enable PKCE (recommended: true)
  redirectUrlOnSuccess: string,      // Where to redirect after successful login
  redirectUrlOnError: string,        // Where to redirect on error
  
  // Optional
  defaultScopes?: string[],          // Scopes to request (default: ['openid', 'email', 'profile'])
  extraAuthParams?: Record<string, string>,  // Extra URL params for auth request
  tokenAuthMethod?: 'client_secret_basic' | 'client_secret_post'  // How to send credentials
}
```

### OAuth Provider Schema

```ts
{
  kind: 'oauth',
  
  // Required
  name: string,                      // URL-safe name (e.g., 'github', 'x')
  authorizationEndpoint: string,     // Provider's authorization URL
  tokenEndpoint: string,             // Provider's token exchange URL
  userInfoEndpoint: string,          // Provider's user info URL
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  supportPKCE: boolean,
  redirectUrlOnSuccess: string,
  redirectUrlOnError: string,
  
  // Optional
  defaultScopes?: string[],
  extraAuthParams?: Record<string, string>,
  tokenAuthMethod?: 'client_secret_basic' | 'client_secret_post',
  
  // Email handling (see Email Requirements section)
  emailCallBack?: (accessToken: string) => Promise<string>,
  
  // Extra data fetching
  extraUserInfoCallBacks?: Array<(accessToken: string) => Promise<Record<string, unknown>>>
}
```

---

## Email Requirements

> [!IMPORTANT]
> **The auth server REQUIRES a valid email address for every user.** If the provider doesn't return an email, the OAuth flow will fail.

### How Email Resolution Works

The library uses a 3-step fallback strategy:

```
┌────────────────────────────────────────────────────────────────┐
│                    Email Resolution Order                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Direct Email Property                                      │
│     └─▶ userData.email exists? ✓ Use it                       │
│                           │                                    │
│                           ▼ No                                 │
│  2. emailCallBack Function                                     │
│     └─▶ Configured? Call it ▶ Returns email string? ✓ Use it  │
│                           │                                    │
│                           ▼ No                                 │
│  3. Auto-Discovery                                             │
│     └─▶ Search userData object for any key containing 'email' │
│         that matches email regex pattern                       │
│                           │                                    │
│                           ▼ Not found                          │
│  4. Error                                                      │
│     └─▶ 400 Bad Request: "Missing Email"                      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### When to Use emailCallBack

You **MUST** provide an `emailCallBack` when:

| Provider | Reason | Scopes Needed |
|----------|--------|---------------|
| GitHub | Email is on separate endpoint | `user:email` |
| Twitter/X | Email requires verified account | `users.email` |
| LinkedIn | Email may be in different field | `email` |
| Discord | Email requires `email` scope | `email` |

### Example: GitHub Email Callback

GitHub doesn't return email in the main user response. You must call `/user/emails`:

```ts
{
  kind: 'oauth',
  name: 'github',
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  userInfoEndpoint: 'https://api.github.com/user',
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  redirectUri: 'https://yourapp.com/oauth/callback/github',
  defaultScopes: ['read:user', 'user:email'],  // Must include user:email!
  supportPKCE: true,
  redirectUrlOnSuccess: 'https://yourapp.com/dashboard',
  redirectUrlOnError: 'https://yourapp.com/login',
  
  // Fetch email from GitHub's emails endpoint
  emailCallBack: async (accessToken: string): Promise<string> => {
    const res = await fetch('https://api.github.com/user/emails', {
      headers: { 'Authorization': `token ${accessToken}` }
    });
    
    const emails = await res.json() as Array<{ email: string; primary?: boolean }>;
    
    if (!emails?.length) {
      throw new Error('No email provided by GitHub');
    }
    
    // Prefer primary email, fallback to first
    const primary = emails.find(e => e.primary);
    return primary?.email ?? emails[0].email;
  }
}
```

---

## Provider-Specific Guides

### Google (OIDC)

```ts
{
  kind: 'oidc',
  name: 'google',
  issuer: 'https://accounts.google.com',
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'https://yourapp.com/oauth/callback/google',
  supportPKCE: true,
  redirectUrlOnSuccess: 'https://yourapp.com/dashboard',
  redirectUrlOnError: 'https://yourapp.com/login',
  defaultScopes: ['openid', 'email', 'profile'],
  extraAuthParams: {
    access_type: 'offline',     // Get refresh token
    prompt: 'consent'           // Always show consent screen
  }
}
```

### Microsoft / Azure AD (OIDC)

```ts
{
  kind: 'oidc',
  name: 'microsoft',
  issuer: 'https://login.microsoftonline.com/{tenant-id}/v2.0',  // Replace {tenant-id}
  clientId: process.env.AZURE_CLIENT_ID!,
  clientSecret: process.env.AZURE_CLIENT_SECRET!,
  redirectUri: 'https://yourapp.com/oauth/callback/microsoft',
  supportPKCE: true,
  redirectUrlOnSuccess: 'https://yourapp.com/dashboard',
  redirectUrlOnError: 'https://yourapp.com/login',
  defaultScopes: ['openid', 'email', 'profile', 'User.Read']
}
```

### GitHub (OAuth)

```ts
{
  kind: 'oauth',
  name: 'github',
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  userInfoEndpoint: 'https://api.github.com/user',
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  redirectUri: 'https://yourapp.com/oauth/callback/github',
  defaultScopes: ['read:user', 'user:email'],
  supportPKCE: true,
  redirectUrlOnSuccess: 'https://yourapp.com/dashboard',
  redirectUrlOnError: 'https://yourapp.com/login',
  emailCallBack: async (accessToken) => {
    const res = await fetch('https://api.github.com/user/emails', {
      headers: { 'Authorization': `token ${accessToken}` }
    });
    const emails = await res.json();
    return emails.find((e: any) => e.primary)?.email ?? emails[0]?.email;
  }
}
```

### Twitter/X (OAuth 2.0)

```ts
{
  kind: 'oauth',
  name: 'x',
  authorizationEndpoint: 'https://twitter.com/i/oauth2/authorize',
  tokenEndpoint: 'https://api.twitter.com/2/oauth2/token',
  userInfoEndpoint: 'https://api.twitter.com/2/users/me?user.fields=id,name,profile_image_url',
  clientId: process.env.X_CLIENT_ID!,
  clientSecret: process.env.X_CLIENT_SECRET!,
  redirectUri: 'https://yourapp.com/oauth/callback/x',
  defaultScopes: ['users.read', 'tweet.read', 'offline.access'],
  supportPKCE: true,
  tokenAuthMethod: 'client_secret_basic',  // X requires Basic auth
  redirectUrlOnSuccess: 'https://yourapp.com/dashboard',
  redirectUrlOnError: 'https://yourapp.com/login'
  // Note: X only returns email for verified accounts with email scope
}
```

### LinkedIn (OAuth 2.0)

```ts
{
  kind: 'oauth',
  name: 'linkedin',
  authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
  userInfoEndpoint: 'https://api.linkedin.com/v2/userinfo',
  clientId: process.env.LINKEDIN_CLIENT_ID!,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
  redirectUri: 'https://yourapp.com/oauth/callback/linkedin',
  defaultScopes: ['openid', 'profile', 'email'],
  supportPKCE: false,  // LinkedIn doesn't support PKCE
  tokenAuthMethod: 'client_secret_post',  // LinkedIn requires POST body
  redirectUrlOnSuccess: 'https://yourapp.com/dashboard',
  redirectUrlOnError: 'https://yourapp.com/login'
}
```

### Discord (OAuth 2.0)

```ts
{
  kind: 'oauth',
  name: 'discord',
  authorizationEndpoint: 'https://discord.com/oauth2/authorize',
  tokenEndpoint: 'https://discord.com/api/oauth2/token',
  userInfoEndpoint: 'https://discord.com/api/users/@me',
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  redirectUri: 'https://yourapp.com/oauth/callback/discord',
  defaultScopes: ['identify', 'email'],  // Must include 'email'!
  supportPKCE: true,
  tokenAuthMethod: 'client_secret_post',
  redirectUrlOnSuccess: 'https://yourapp.com/dashboard',
  redirectUrlOnError: 'https://yourapp.com/login'
}
```

---

## Advanced Configuration

### Extra Auth Parameters

Use `extraAuthParams` to add custom parameters to the authorization URL:

```ts
extraAuthParams: {
  // Force re-authentication
  prompt: 'login',
  
  // Request specific claims
  claims: JSON.stringify({
    id_token: { email: { essential: true } }
  }),
  
  // Request offline access (refresh tokens)
  access_type: 'offline',
  
  // Include previously granted scopes
  include_granted_scopes: 'true',
  
  // Specify response mode (rarely needed)
  response_mode: 'query',  // or 'form_post'
  
  // Customize login hint
  login_hint: 'user@example.com',
  
  // Specify account selection
  account_select: 'force'
}
```

### Extra User Info Callbacks

Fetch additional data to merge into the user profile:

```ts
extraUserInfoCallBacks: [
  // Fetch organization membership
  async (accessToken) => {
    const res = await fetch('https://api.github.com/user/orgs', {
      headers: { 'Authorization': `token ${accessToken}` }
    });
    const orgs = await res.json();
    return { organizations: orgs.map((o: any) => o.login) };
  },
  
  // Fetch repos count
  async (accessToken) => {
    const res = await fetch('https://api.github.com/user/repos?per_page=1', {
      headers: { 'Authorization': `token ${accessToken}` }
    });
    return { hasRepos: res.headers.get('Link')?.includes('next') };
  }
]
```

> [!NOTE]
> Extra callbacks are merged **safely** - they cannot overwrite core fields like `email`, `id`, or `sub`.

### Token Auth Methods

Different providers require credentials in different ways:

| Method | How Credentials Are Sent | Providers |
|--------|-------------------------|-----------|
| `client_secret_basic` (default) | Base64 in `Authorization` header | Google, Microsoft, Twitter/X |
| `client_secret_post` | In request body | LinkedIn, Facebook, some OIDC |

```ts
tokenAuthMethod: 'client_secret_post'
```

---

## Security Features

The OAuth implementation includes these security measures:

### PKCE (Proof Key for Code Exchange)

When `supportPKCE: true`:
- Generates cryptographically random `code_verifier`
- Creates SHA-256 `code_challenge`
- Prevents authorization code interception attacks

### State Parameter

- Signed with your `cryptoCookiesSecret`
- Includes provider name and random bytes
- Stored in HttpOnly, Secure, SameSite=Lax cookie
- Verified before token exchange

### Nonce (OIDC Only)

- Random 32-byte value stored in cookie
- Embedded in `id_token` by provider
- Verified after token receipt
- Prevents replay attacks

### at_hash Validation (OIDC Only)

- Verifies access token is bound to id_token
- Uses timing-safe comparison
- Prevents token substitution attacks

### Cookie Security

All OAuth cookies are set with:
```ts
{
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 180  // 3 minutes
}
```

---

## Troubleshooting

### "Missing Email" Error

**Cause:** Provider didn't return an email and no `emailCallBack` was configured.

**Solutions:**
1. Check your scopes include email (e.g., `user:email` for GitHub)
2. Implement `emailCallBack` to fetch email from secondary endpoint
3. Ensure user has verified email on provider

### "Invalid State" Error

**Cause:** State cookie expired or was not sent.

**Solutions:**
1. Ensure cookies are enabled in browser
2. Check `sameSite` policy isn't blocking cookie
3. Verify redirect URI domain matches cookie domain

### "PKCE Verification Failed"

**Cause:** Code verifier doesn't match challenge.

**Solutions:**
1. Ensure `supportPKCE` matches provider's capability
2. Check cookie wasn't cleared between redirect and callback
3. Verify no proxy is modifying request parameters

### "Token Endpoint Error"

**Cause:** Provider rejected token exchange.

**Solutions:**
1. Verify `clientId` and `clientSecret` are correct
2. Check `redirectUri` exactly matches provider configuration
3. Try different `tokenAuthMethod` (`basic` vs `post`)
4. Check provider's rate limits

### "ID Token Validation Failed" (OIDC)

**Cause:** JWT signature verification failed.

**Solutions:**
1. Verify `issuer` URL is correct (exact match required)
2. Check provider's JWKS endpoint is accessible
3. Ensure server clock is synchronized (for exp/nbf validation)

---

## Complete Multi-Provider Example

```ts
import { configuration } from 'auth-h3client';
import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';

const storage = createStorage({ driver: memoryDriver() });

configuration({
  server: {
    auth_location: {
      serverOrDNS: process.env.AUTH_HOST!,
      port: Number(process.env.AUTH_PORT!)
    },
    hmac: {
      enableHmac: true,
      clientId: process.env.AUTH_CLIENT_ID!,
      sharedSecret: process.env.AUTH_SHARED_SECRET!
    },
    ssl: { enableSSL: false },
    cryptoCookiesSecret: process.env.COOKIE_SECRET!
  },
  
  uStorage: {
    storage,
    cacheOptions: {
      successTtl: 60 * 60 * 24 * 30,
      rateLimitTtl: 10
    }
  },
  
  onSuccessRedirect: 'https://yourapp.com/dashboard',
  enableFireWallBans: true,
  logLevel: 'info',
  
  telegram: { enableTelegramLogger: false },
  
  OAuthProviders: [
    // Google (OIDC)
    {
      kind: 'oidc',
      name: 'google',
      issuer: 'https://accounts.google.com',
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: 'https://yourapp.com/oauth/callback/google',
      supportPKCE: true,
      redirectUrlOnSuccess: 'https://yourapp.com/dashboard',
      redirectUrlOnError: 'https://yourapp.com/login',
      defaultScopes: ['openid', 'email', 'profile'],
      extraAuthParams: { access_type: 'offline', prompt: 'consent' }
    },
    
    // GitHub (OAuth)
    {
      kind: 'oauth',
      name: 'github',
      authorizationEndpoint: 'https://github.com/login/oauth/authorize',
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
      userInfoEndpoint: 'https://api.github.com/user',
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: 'https://yourapp.com/oauth/callback/github',
      defaultScopes: ['read:user', 'user:email'],
      supportPKCE: true,
      redirectUrlOnSuccess: 'https://yourapp.com/dashboard',
      redirectUrlOnError: 'https://yourapp.com/login',
      emailCallBack: async (accessToken) => {
        const res = await fetch('https://api.github.com/user/emails', {
          headers: { 'Authorization': `token ${accessToken}` }
        });
        const emails = await res.json();
        return emails.find((e: any) => e.primary)?.email ?? emails[0]?.email;
      }
    },
    
    // Microsoft (OIDC)
    {
      kind: 'oidc',
      name: 'microsoft',
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      redirectUri: 'https://yourapp.com/oauth/callback/microsoft',
      supportPKCE: true,
      redirectUrlOnSuccess: 'https://yourapp.com/dashboard',
      redirectUrlOnError: 'https://yourapp.com/login',
      defaultScopes: ['openid', 'email', 'profile']
    },
    
    // LinkedIn (OAuth)
    {
      kind: 'oauth',
      name: 'linkedin',
      authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
      userInfoEndpoint: 'https://api.linkedin.com/v2/userinfo',
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirectUri: 'https://yourapp.com/oauth/callback/linkedin',
      defaultScopes: ['openid', 'profile', 'email'],
      supportPKCE: false,
      tokenAuthMethod: 'client_secret_post',
      redirectUrlOnSuccess: 'https://yourapp.com/dashboard',
      redirectUrlOnError: 'https://yourapp.com/login'
    }
  ]
});
```

---

## See Also

- [Configuration Guide](./configuration.md) - Full configuration reference
- [Routes and Controllers](./routes-and-controllers.md) - All available routes
- [CSRF and Visitor Validation](./csrf-and-visitor.md) - Security middlewares
