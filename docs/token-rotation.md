# Token Rotation and Metadata

The library provides helpers to keep access and refresh credentials valid without blocking the user. It queries metadata from the auth service and rotates as needed.

## Components

- Access token flow: `ensureAccessToken` (src/middleware/getAccessToken.ts)
- Refresh token flow: `ensureRefreshCookie` (src/middleware/getRefreshToken.ts)
- Full pair rotation: `ensureValidCredentials` (src/middleware/rotateTokens.ts)
- Metadata utilities: `getAccessTokenMetaData`, `getRefreshTokenMetaData` (src/utils)
- Local cache: `MiniCache` stores metadata until near expiry.

## Access token logic

1. Read `__Secure-a` (access) and `session` (refresh) cookies and a `canary_id`.
2. If access token missing → request `/auth/refresh-access` to mint a new access token.
3. Otherwise fetch metadata for the access token:
   - If `mfa` → return 202 to trigger MFA path.
   - If `authorized === false` or `shouldRotate === true` or server error → rotate.
4. On success, set `event.context.accessToken`.

## Refresh token logic

1. Validate presence of `session`, `canary_id`, and read `iat` cookie.
2. Query `/secret/refreshtoken/metadata`:
   - If `shouldRotate` → rotate via `/auth/user/refresh-session`.
   - If unauthorized or server error → throw and force re-authentication.
3. On success, set `event.context.session`.

## Full pair rotation

`ensureValidCredentials` rotates both tokens using `/auth/refresh-session/rotate-every` and sets new access token + `a-iat`.

## Error surfaces

- 401 → `AUTH_REQUIRED` (re-authentication)
- 202 → MFA required path
- 429 → User rate limited (optional `Retry-After` header forwarded)
- 5xx → `AUTH_SERVER_ERROR` or `SERVER_ERROR`

## Example usage

```ts
router.get('/protected', defineEventHandler(async (event) => {
  const mfa = await ensureValidCredentials(event);
  if (mfa && 'text' in mfa) {
    event.res.status = 202;
    return mfa;
  }
  // Safe to call upstream with event.context.accessToken
  return { ok: true };
}));
```

