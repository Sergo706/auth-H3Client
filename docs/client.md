# Client-Side Authentication

The client package provides valid-credential enforcement for your frontend. It ensures strict type-safety and composable authentication state management.

## Setup

### 1. Global Guard (`app.vue`)

In your root component, await the auth state. This pauses mounting until the session is validated (or refreshed).

```vue
<script setup lang="ts">
import { useAuthData } from 'auth-h3client/client';

// Pauses app initialization until auth state is known/rotated
await useAuthData();
</script>
```

### 2. Route Guard (`middleware/auth.global.ts`)

Protect client-side navigation.

```ts
import { useAuthData } from 'auth-h3client/client';

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.client) {
    await useAuthData();
  }
});
```

## API Reference

### `useAuthData(authStatusUrl?)`
`async (authStatusUrl = '/users/authStatus') => Promise<Ref<AuthState>>`

Checks and returns the current authentication state.
- **Singleton**: Multiple concurrent calls trigger only one network request.
- **Reactive**: Updates the global `useState('auth')` reactive reference.

### `getCsrfToken()`
`() => string | undefined`

Retrieves the CSRF token from the `__Host-csrf` cookie. Returns `undefined` if not found.
