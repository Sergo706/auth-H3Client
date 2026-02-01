# Client-Side Authentication

The client package provides valid-credential enforcement for your frontend. It ensures strict type-safety and composable authentication state management.

## Setup

### 1. Global Guard (`app.vue`)

In your root component, await the auth state. This pauses mounting until the session is validated (or refreshed).

```vue
<script setup lang="ts">
// Auto-imported by Nuxt module, or:
// import { useAuthData } from 'auth-h3client/client';

// Pauses app initialization until auth state is known
const auth = await useAuthData();

if (!auth.value.authorized) {
  if (auth.value.mfaRequired) {
    navigateTo('/mfa-verify');
  } else {
    navigateTo('/login');
  }
}
</script>
```

### 2. Route Guard (`middleware/auth.global.ts`)

Protect client-side navigation.

```ts
export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.client) {
    const auth = await useAuthData();
    if (!auth.value.authorized) {
      return navigateTo('/login');
    }
  }
});
```

---

## API Reference

### `useAuthData(authStatusUrl?)`

```ts
async (authStatusUrl = '/auth/users/authStatus') => Promise<Ref<AuthState>>
```

Checks and returns the current authentication state.

**Features:**
- **Singleton Pattern**: Uses `useState('auth')` to prevent duplicate requests during hydration
- **Server-Side Cookie Forwarding**: Automatically forwards `Set-Cookie` headers from API response to client
- **MFA Detection**: Detects 202 status codes and sets `mfaRequired: true`
- **Cached Hydration**: Uses `getCachedData` to reuse SSR data on client

**AuthState Type:**
```ts
interface AuthState {
  id?: string;           // User ID (when authorized)
  authorized: boolean;   // Whether the user is authenticated
  mfaRequired: boolean;  // Whether MFA verification is pending
  message?: string;      // Optional message (e.g., MFA instructions)
}
```

**Example:**
```ts
const auth = await useAuthData();

if (auth.value.authorized) {
  console.log('User ID:', auth.value.id);
} else if (auth.value.mfaRequired) {
  console.log('MFA required:', auth.value.message);
}
```

---

### `executeRequest<T>(url, method, body?, customHeaders?, customOptions?, context?)`

```ts
async <T>(
  url: string,
  method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH",
  body?: object,
  customHeaders?: Record<string, string>,
  customOptions?: FetchOptions<'json'>,
  context?: ApiContext
) => Promise<Results<T>>
```

Universal fetch wrapper that handles authentication, CSRF, and server-side cookie propagation.

**Features:**
- **Client-Side**: Auto-injects `X-CSRF-Token` if available
- **Server-Side**: Proxies headers from incoming request (cookies, auth tokens)
- **Cookie Propagation**: Forwards `Set-Cookie` from API response to browser

**ApiContext:**
```ts
interface ApiContext {
  fetcher?: H3Event$Fetch | $Fetch;  // Custom fetch instance
  event?: H3Event;                    // H3 event for SSR cookie forwarding
  headers?: Record<string, string>;   // Additional headers (server-side)
}
```

**Example (Client-Side):**
```ts
import { executeRequest } from 'auth-h3client/client';

const result = await executeRequest<{ user: User }>('/api/profile', 'GET');
if (result.ok) {
  console.log(result.data.user);
}
```

**Example (Server-Side with event):**
```ts
import { executeRequest } from 'auth-h3client/client';

export default defineEventHandler(async (event) => {
  const result = await executeRequest<{ data: any }>(
    '/api/internal',
    'POST',
    { action: 'fetch' },
    {},
    {},
    { event, headers: getHeaders(event) }
  );
  return result;
});
```

---

### `getCsrfToken()`

```ts
() => string | undefined
```

Retrieves the CSRF token from the `__Host-csrf` cookie. Returns `undefined` if not found.

**Usage:**
```ts
import { getCsrfToken } from 'auth-h3client/client';

const token = getCsrfToken();
// Use in manual fetch: { headers: { 'X-CSRF-Token': token } }
```

> [!NOTE]
> You typically don't need to call this directly if using `executeRequest`, as it auto-injects the CSRF token on client-side requests.
