# Routes and Controllers

High-level registrars wire recommended endpoints; you can also compose controllers manually.

## Registrars

- `useAuthRoutes` (src/routes/auth.ts)
  - POST `/signup`  -> `handleSignUps`
  - POST `/login`   -> `handleLogin`
  - POST `/logout`  -> `handleLogout`

- `magicLinksRouter` (src/routes/magicLinks.ts)
  - GET  `/auth/verify-mfa/:visitor`     -> `verifyTempLink`
  - POST `/auth/verify-mfa/:visitor`     -> `sendMfaCode`
  - POST `/auth/password-reset`          -> `restartPasswordController`
  - GET  `/auth/reset-password/:visitor` -> `verifyTempLink`
  - POST `/auth/reset-password/:visitor` -> `sendNewPassword`

- `useOAuthRoutes` (src/routes/OAuth.ts)
  - GET `/oauth/:provider`               -> `OAuthRedirect`
  - GET `/oauth/callback/:provider`      -> `OAuthTokensValidations` -> `OAuthCallback`

## Manual composition

```ts
router.post('/signup', signUpHandler, {
  middleware: [verifyCsrfCookie, contentType('application/json'), limitBytes(1024)]
});
```

## Version notes (H3 v1 vs v2)

Route-level middleware attachment differs by H3 version:

- H3 v1
  ```ts
  router.use('/login', verifyCsrfCookie)
  router.use('/login', contentType('application/json'))
  router.use('/login', limitBytes(1024))
  router.post('/login', loginHandler)
  ```

- H3 v2
  ```ts
  router.post('/login', loginHandler, {
    middleware: [verifyCsrfCookie, contentType('application/json'), limitBytes(1024)]
  })
  ```

For a complete overview, see docs/h3-v1-v2.md.
