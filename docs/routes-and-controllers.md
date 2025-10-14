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

