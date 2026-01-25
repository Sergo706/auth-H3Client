# Client-Side Authentication

The client package provides valid-credential enforcement for your frontend. It ensures requests wait for any in-progress token rotation before firing, preventing 401 race conditions.

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

## Making Requests (`AuthBase`)

Extend `AuthBase` to get access to `authFetch`, which waits for the auth lock.

```ts
import AuthBase from 'auth-h3client/client';

export default class UsersService extends AuthBase {
  async getProfile() {
    // 1. Wait for valid commands
    const auth = await this.waitForAuth();
    
    // 2. Fail fast (optional optimization)
    if (!auth.authorized) return null;

    // 3. Send request (guaranteed valid tokens)
    return await this.authFetch('/api/users/profile');
  }
}
```

## API Reference

### `useAuthData()`
Returns `Promise<Ref<AuthState>>`.
- **Singleton**: Multiple concurrent calls trigger only one network check.
- **Reactive**: Updates the global auth state.

### `AuthBase` methods

- **`waitForAuth()`**: Returns `Promise<AuthState>`. memory-fast if already checked by `useAuthData`.
- **`authFetch(url, options)`**: Wrapper around `$fetch`. Waits for rotation lock before sending.
- **`authFetch(url, true, options)`**: Returns a configured `$fetch.create` instance (useful for sub-services).
