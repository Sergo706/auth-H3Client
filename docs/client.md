# Client Package

The `auth-h3client/client` subpath provides client-side utilities for Nuxt/Vue applications to handle authentication state.

## Installation

The client package is included in the main package. Import from the `client` subpath:

```ts
import { AuthBase, useAuthData } from 'auth-h3client/client';
```

## Peer Dependencies

```json
{
  "nuxt": "^4.2.1",
  "vue": "^3.5.18",
  "ofetch": "^1.0.0"
}
```

---

## useAuthData Composable

A Nuxt composable that checks authentication status and maintains reactive auth state.

### Import

```ts
import { useAuthData, type AuthState, type ServerResponse } from 'auth-h3client/client';
```

### Usage

```ts
// In a Nuxt page or component
const authRef = await useAuthData();

// Access the reactive state
console.log(authRef.value.authorized);  // boolean
console.log(authRef.value.id);          // user ID if authenticated
console.log(authRef.value.mfaRequired); // true if MFA step needed
```

### Custom Auth Status Endpoint

By default, `useAuthData` calls `/users/authStatus`. You can override this:

```ts
const authRef = await useAuthData('/api/custom/auth-status');
```

### AuthState Interface

```ts
interface AuthState {
  id?: string;
  authorized: boolean;
  mfaRequired: boolean;
  message?: string;
}
```

### Behavior

1. **Deduplication**: Multiple concurrent calls share the same request
2. **SSR-safe**: Uses `useState` for SSR hydration
3. **Request headers forwarding**: Automatically forwards request headers for SSR
4. **Error handling**: Returns `{ authorized: false, mfaRequired: false }` on errors

### Response Handling

| Status | Behavior |
|--------|----------|
| `200` + `authorized: true` | Sets `authorized: true` with user ID |
| `202` | Sets `mfaRequired: true` with MFA message |
| `401` or no data | Sets `authorized: false` |
| Error | Sets `authorized: false`, logs error |

---

## AuthBase Class

A base class for creating authenticated API clients.

### Import

```ts
import { AuthBase } from 'auth-h3client/client';
```

### Usage

```ts
class MyApiClient extends AuthBase {
  constructor() {
    super({
      'X-Custom-Header': 'value'
    });
  }

  async getProfile() {
    return this.authFetch<UserProfile>('/api/profile');
  }

  async updateSettings(data: Settings) {
    return this.authFetch<void>('/api/settings', {
      method: 'POST',
      body: data
    });
  }
}

// Usage
const client = new MyApiClient();
const profile = await client.getProfile();
```

### Methods

#### `waitForAuth(): Promise<AuthState>`

Waits for authentication check to complete and returns the current auth state.

```ts
const auth = await client.waitForAuth();
if (auth.authorized) {
  // User is authenticated
}
```

#### `authFetch<T>(url: string, options?: any): Promise<T>`

Makes an authenticated fetch request. Automatically:
- Waits for auth check to complete
- Merges constructor headers with request headers

```ts
const data = await client.authFetch<MyData>('/api/endpoint', {
  method: 'POST',
  body: { foo: 'bar' }
});
```

---

## Example: Protected Page

```vue
<script setup lang="ts">
import { useAuthData } from 'auth-h3client/client';

const auth = await useAuthData();

if (!auth.value.authorized) {
  if (auth.value.mfaRequired) {
    navigateTo('/mfa');
  } else {
    navigateTo('/login');
  }
}
</script>

<template>
  <div v-if="auth.authorized">
    <p>Welcome, user {{ auth.id }}!</p>
  </div>
</template>
```

## Example: API Client

```ts
// ~/utils/api.ts
import { AuthBase } from 'auth-h3client/client';

class ApiClient extends AuthBase {
  async getPosts() {
    return this.authFetch<Post[]>('/api/posts');
  }

  async createPost(title: string, content: string) {
    return this.authFetch<Post>('/api/posts', {
      method: 'POST',
      body: { title, content }
    });
  }
}

export const api = new ApiClient();
```

```vue
<script setup lang="ts">
import { api } from '~/utils/api';

const posts = await api.getPosts();
</script>
```
