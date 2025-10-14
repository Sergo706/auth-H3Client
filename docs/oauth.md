# OAuth and OIDC Flow

Implements both OIDC (`kind: 'oidc'`) and generic OAuth (`kind: 'oauth'`) flows.

## Components

- Redirect: `OAuthRedirect` (src/controllers/OAuthRedirect.ts)
- Callback middleware: `OAuthTokensValidations` (src/middleware/OAuthCallBack.ts)
- Success handler: `OAuthCallback` (src/controllers/OAuthSuccessCallBack.ts)
- Helpers: `discoverOidc`, `verifyOAuthToken`, `makePkcePair`

## Redirect

1. Validates provider from `OAuthProviders`.
2. Issues signed `state`, optional `nonce`, and optional PKCE cookies.
3. Redirects to `authorization_endpoint` with `response_type=code`, default scopes, and extra params.

## Callback validation

1. Parses query with zod schema; checks `error` and `code`.
2. Verifies `state` signature and (for OIDC) `iss`.
3. Exchanges code for tokens (supports `client_secret_basic` or `client_secret_post`).
4. For OIDC:
   - Verifies `id_token` against JWKS; checks `nonce`, optional `azp`, optional `at_hash`.
   - Optionally calls `userinfo_endpoint` and merges values.
5. For OAuth:
   - Requires `access_token`; fetches `userInfoEndpoint`.
6. Stores `{ provider, userData, accessToken }` in `event.context`.

## Success handler

- Sends the normalized user payload to the auth service `/auth/OAuth/:provider`.
- Sets issued cookies and optional access token cookies.
- Returns an HTML meta-refresh + JS redirect to provider-specific success URL.

## Email and extra user info callbacks (OAuth)

- `emailCallBack(accessToken) => Promise<string>`: used when userinfo lacks email.
- `extraUserInfoCallBacks[]`: returns objects merged (safely) into the user payload.

## Example

```ts
useOAuthRoutes(app);
// Internally wires:
// GET /oauth/:provider           -> OAuthRedirect
// GET /oauth/callback/:provider  -> OAuthTokensValidations -> OAuthCallback
```

