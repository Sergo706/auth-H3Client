# OIDC, OAuth, and PKCE

Utilities for handling OpenID Connect flows and token validation.

## `makePkcePair`

Generates PCKE (Proof Key for Code Exchange) secrets. This is critical for preventing authorization code interception attacks.

**Returns:**
```typescript
{
  codeVerifier: string;  // Send this in step 2 (token exchange)
  codeChallenge: string; // Send this in step 1 (auth redirect)
}
```

**Usage:**
```typescript
const { codeVerifier, codeChallenge } = await makePkcePair();
// Store verifier in a signed cookie
// Send challenge to provider
```

## `discoverOidc`

Fetches the OIDC Metadata document (`/.well-known/openid-configuration`) for a given issuer. Caches the result to avoid redundant network calls.

**Usage:**
```typescript
const config = await discoverOidc('https://accounts.google.com');
console.log(config.authorization_endpoint);
```

## `verifyOAuthToken`

Validates a JWT ID Token signature against the provider's Public Keys (JWKS).

**Signature:**
```typescript
async function verifyOAuthToken(
  idToken: string, 
  jwksUri: string, 
  alg: string, 
  issuer: string, 
  audience: string
): Promise<JWTPayload>
```

**Usage:**
Use this when manually handling OAuth callbacks to ensure the ID Token is authentic.

## `atHashCheck`

Validates the `at_hash` claim in an ID Token. This ensures that the Access Token associated with the ID Token hasn't been substituted.

**Usage:**
```typescript
import { atHashCheck } from 'auth-h3client/v1';

atHashCheck(accessToken, idToken.at_hash); // Throws if invalid
```
