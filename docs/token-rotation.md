# Token Rotation and Metadata

The library provides helpers to keep access and refresh credentials valid without blocking the user. It queries metadata from the auth service and rotates as needed. This client is designed to front the upstream [`auth`](https://github.com/Sergo706/auth) service, using cookie-based refresh sessions and a short‑lived access token for API calls.

## Components

- Access token flow: `ensureAccessToken` (src/middleware/getAccessToken.ts)
- Refresh token flow: `ensureRefreshCookie` (src/middleware/getRefreshToken.ts)
- Full pair rotation: `ensureValidCredentials` (src/middleware/rotateTokens.ts)
- Metadata utilities: `getAccessTokenMetaData`, `getRefreshTokenMetaData` (src/utils)
- Local cache: `MiniCache` stores metadata until near expiry.

## Token taxonomy and cookies

- Access token cookie: `__Secure-a` (httpOnly, secure, sameSite=strict)
- Access token issued-at cookie: `a-iat` (httpOnly)
- Refresh token cookie: `session` (httpOnly)
- Refresh token issued-at cookie: `iat` (httpOnly, numeric)
- Canary cookie: `canary_id` (httpOnly) — binds the session to antifraud tracking

The access token’s TTL is provided by `/operational/config` and is re-applied whenever a new token is minted. Refresh token cookies are rotated by the upstream service and returned via `Set-Cookie` headers.

## Access token logic

1. Read `__Secure-a` (access) and `session` (refresh) cookies and a `canary_id`.
2. If access token missing → request `POST /auth/refresh-access` to mint a new access token.
3. Otherwise fetch metadata for the access token via `GET /secret/accesstoken/metadata` (with `Authorization: Bearer <access>` and cookies):
   - If `mfa` → return 202 to trigger MFA path.
   - If `authorized === false` or `shouldRotate === true` or server error → rotate.
4. On success, cache the metadata (until `msUntilExp - refreshThreshold - 5000ms`) and set `event.context.accessToken`.

## Refresh token logic

1. Validate presence of `session`, `canary_id`, and read `iat` cookie.
2. Query `GET /secret/refreshtoken/metadata` with cookies (`session`, `canary_id`, `iat`):
   - If `shouldRotate` → rotate via `/auth/user/refresh-session`.
   - If unauthorized or server error → throw and force re-authentication.
3. On success, set `event.context.session`.

## Full pair rotation

`ensureValidCredentials` rotates both tokens using `POST /auth/refresh-session/rotate-every` and sets:

- New refresh token cookies returned by the service (forwarded from `Set-Cookie`)
- New access token cookie `__Secure-a` and its `a-iat`

It also updates `event.context.session` and `event.context.accessToken` so downstream handlers can proceed.

When metadata is available and healthy, this function avoids extra rotations by consulting the access-token cache first.

## Response codes and behavior

- 200/201 → Rotation or verification succeeded
- 202 → MFA required path (client should show MFA UI)
- 400 → Client input invalid (rare for rotation; typical in controllers)
- 401 → `AUTH_REQUIRED` (re-authentication)
- 403 → Forbidden (e.g., banned/blacklisted)
- 404 → User/session not found
- 429 → Rate limited (if `Retry-After` present, forwarded to the client)
- 5xx → `AUTH_SERVER_ERROR` or `SERVER_ERROR`

Errors are thrown via `throwError(log, event, ...)` or, when acceptable, surfaced as `{ error: string }` with `event.res.status` set accordingly (e.g., 202/429 fast-paths).

## Metadata cache details

- Access metadata TTL: `max(0, msUntilExp - refreshThreshold - 5000)`
- Refresh metadata TTL: same pattern, using the refresh metadata fields
- On negative signals (`authorized === false`, `serverError`, `shouldRotate`), the entry is removed from cache.
- Keyed by token value (`accessToken` or `refreshToken`).

## Common scenarios

1) First request after login

- Cookies present: `session`, `iat`, `canary_id` and the server just issued refresh set; controller also set `__Secure-a`.
- Access metadata is not cached → `ensureAccessToken` verifies meta; no rotation if healthy.

2) Access token missing, refresh valid

- `ensureAccessToken` calls `POST /auth/refresh-access` to mint a fresh access token, sets `__Secure-a` + `a-iat`.

3) Access token near expiry

- Metadata indicates `shouldRotate` due to threshold → rotate access token or both (depending on handler), update cookies, cache new meta.

4) Refresh token near expiry

- `ensureRefreshCookie` metadata indicates `shouldRotate` → `POST /auth/user/refresh-session`, forward `Set-Cookie` headers, update `event.context.session`.

5) MFA required

- Metadata returns `202`/`mfa: true` → middleware returns `{ text: 'MFA required', message? }` and sets `event.res.status = 202`.

6) Rate limited

- Upstream 429 → `Retry-After` is appended to response headers and a transient error is surfaced.

## Example usage

- H3 v1

```ts
import { defineEventHandler } from 'h3'

router.get('/protected', defineEventHandler(async (event) => {
  const mfa = await ensureValidCredentials(event);
  if (mfa && 'text' in mfa) {
    event.res.statusCode = 202;
    return mfa;
  }
  // Safe to call upstream with event.context.accessToken
  return { ok: true };
}));
```

- H3 v2

```ts
import { defineHandler } from 'h3'

router.get('/protected', defineHandler(async (event) => {
  const mfa = await ensureValidCredentials(event);
  if (mfa && 'text' in mfa) {
    event.res.status = 202;
    return mfa;
  }
  // Safe to call upstream with event.context.accessToken
  return { ok: true };
}));
```

## See also

For higher-level wrappers that handle auth and caching automatically:

- [defineAuthenticatedEventHandler](wrappers/defineAuthenticatedEventHandler.md) - Wraps handlers with full authentication
- [getCachedUserData](wrappers/getCachedUserData.md) - Low-level user data fetching with cache
