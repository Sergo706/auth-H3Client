# Authentication Flow Utilities

These are the core handlers that power the login, signup, and OAuth flows. In most Nuxt setups, these are automatically wired to routes, but you can use them manually in pure H3.

## `loginHandler`

Handles the `POST /login` route.

**Usage:**
```typescript
import { loginHandler } from 'auth-h3client/v1';
router.post('/login', loginHandler);
```

**Behavior:**
1.  Expects a JSON body with `email` and `password` (or other credentials configured upstream).
2.  Calls the Auth Service `POST /auth/login`.
3.  On Success:
    -   Sets `__Secure-a`, `session`, `canary_id`, `a-iat` cookies.
    -   Redirects to the configured `onSuccessRedirect`.
4.  On Failure: throws 401 or 403.

## `signUpHandler`

Handles the `POST /signup` route.

**Usage:**
```typescript
import { signUpHandler } from 'auth-h3client/v1';
router.post('/signup', signUpHandler);
```

**Behavior:**
1.  Expects JSON body matching your registration schema.
2.  Calls Auth Service `POST /auth/signup`.
3.  If email verification is off: logs user in immediately.
4.  If email verification is on: returns 200 "Please check your email".

## `logoutHandler`

Handles `POST /logout` or `GET /logout`.

**Usage:**
```typescript
import { logoutHandler } from 'auth-h3client/v1';
router.post('/logout', logoutHandler);
```

**Behavior:**
1.  Clears all auth cookies (`session`, `__Secure-a`, etc).
2.  Calls Auth Service to revoke the refresh token (if possible).
3.  Redirects to `/` or configured logout path.

## `OAuthRedirect`

Initiates an OAuth 2.0 / OIDC flow.

**Usage:**
```typescript
import { OAuthRedirect } from 'auth-h3client/v1';
// Route: /auth/oauth/:provider
router.get('/auth/oauth/:provider', OAuthRedirect);
```

**Mechanism:**
1.  Reads the `:provider` param.
2.  Looks up provider config in `server/plugins/auth.ts`.
3.  Generates PKCE pair (if enabled).
4.  Generates a robust State cookie (signed).
5.  Redirects user to Google/GitHub/etc.

## `OAuthSuccessCallBack`

Handles the return trip from the provider.

**Usage:**
```typescript
import { OAuthSuccessCallBack } from 'auth-h3client/v1';
// Route: /auth/oauth/:provider/callback
router.get('/auth/oauth/:provider/callback', OAuthSuccessCallBack);
```

**Mechanism:**
1.  Verifies the `state` cookie matches the url param (CSRF check).
2.  Exchanges the Authorization Code for tokens.
3.  Logs the user in (sets cookies).
4.  Redirects to `onSuccessRedirect`.
