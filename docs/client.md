# Client-Side Authentication (Detailed Guide)

This document details how to secure your Nuxt/Vue frontend using the `auth-h3client` primitives. Unlike other libraries that hide complexity behind opaque "auth" objects, this library gives you two precise tools: **State Management** (`useAuthData`) and **Cookie Access** (`getCsrfToken`).

## 1. Concepts

### The "Singleton Gatekeeper" Pattern
Authentication state is managed by a single, global promise called the "Gatekeeper".

-   **Problem**: If a user opens your app and 5 components immediately request data, and the access token is invalid, you don't want to fire 5 refresh requests. Use of `await useAuthData()` prevents this.
-   **Solution**: `useAuthData()` initiates the check *once*. All 5 components await the *same* promise. Once resolved, the state is cached.

### SSR vs Client
-   **Server-Side (SSR)**: The middleware runs `ensureValidCredentials` automatically. The *result* is hydrated to the client. This means `useAuthData` often returns instantly on the client because the server already did the work.
-   **Client-Side**: If the session expires while the user is browsing, `useAuthData` detects the expiry (via 401 or metadata check) and triggers a transparent background rotation.

---

## 2. API Reference

### `useAuthData(authStatusUrl?)`

**Signature**:
```typescript
function useAuthData(authStatusUrl: string = '/users/authStatus'): Promise<Ref<AuthState>>
```

**Returns**: A persistent, reactive `Ref<AuthState>` (shared via `useState('auth')`).

**Properties**:
```typescript
interface AuthState {
  // TRUE if the user has a valid access token.
  // FALSE if the user is guest, expired, or banned.
  authorized: boolean;

  // The User ID (if authorized).
  id?: string;

  // TRUE if the server responded with 202 MFA Required.
  // You should show an OTP modal if this is true.
  mfaRequired: boolean;

  // Error or Info message from the server.
  message?: string;
}
```

### `getCsrfToken()`

**Signature**:
```typescript
function getCsrfToken(): string | undefined
```
**Returns**: The value of the `__Host-csrf` cookie (parsed from `document.cookie`).
**Usage**: Must be included in the header `X-CSRF-Token` for ALL `POST`, `PUT`, `DELETE` requests.

---

## 3. Implementation Patterns

### Pattern A: Global Route Guard (Recommended)

To protect your entire application (or sensitive routes) from rendering before auth is settled.

**`app.vue` (Root Level)**
```vue
<script setup lang="ts">
import { useAuthData } from 'auth-h3client/client';

// 1. BLOCKING check.
// The app will NOT mount until we know if the user is logged in or out.
// If valid, token rotation happens here.
await useAuthData(); 
</script>
```

**`middleware/auth.ts` (Route Level)**
```typescript
import { useAuthData } from "auth-h3client/client";

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = await useAuthData();
  
  if (!auth.value.authorized && to.path !== '/login') {
    return navigateTo('/login');
  }
});
```

### Pattern B: Secure Data Fetching

Since `auth-h3client` does not wrap `fetch`, you must attach the CSRF token manually.

**Using `ofetch` / `$fetch`**
```typescript
import { getCsrfToken } from 'auth-h3client/client';

await $fetch('/api/user/settings', {
  method: 'POST',
  body: { theme: 'dark' },
  headers: {
    // CRITICAL: The server will reject POSTs without this
    'X-CSRF-Token': getCsrfToken() || ''
  }
});
```

**Using `useFetch` (Nuxt)**
```typescript
const { data } = await useFetch('/api/user/settings', {
  headers: {
    'X-CSRF-Token': getCsrfToken() || ''
  }
});
```

### Pattern C: Handling MFA

If the server requires Step-Up Authentication (e.g., for changing passwords), `useAuthData` will report `mfaRequired: true`.

```vue
<script setup>
const auth = await useAuthData();

watchEffect(() => {
  if (auth.value.mfaRequired) {
    showOtpModal.value = true;
  }
});
</script>
```

---

## 4. Troubleshooting

### "401 Unauthorized Loop"
-   **Symptom**: The page reloads endlessly or console shows repetitive 401 errors.
-   **Cause**: The Refresh Token (`session` cookie) is expired or missing, but your code keeps trying to fetch protected data.
-   **Fix**: Ensure you check `if (!auth.value.authorized)` *before* making API calls.

### "CSRF Token Invalid"
-   **Symptom**: POST requests fail with 403.
-   **Cause**: You forgot to send the `X-CSRF-Token` header.
-   **Fix**: Use `getCsrfToken()` in your headers.

### "Hydration Mismatch"
-   **Symptom**: "Text content does not match server-rendered HTML."
-   **Cause**: Reading `document.cookie` (via `getCsrfToken`) during SSR.
-   **Fix**: `getCsrfToken` handles this gracefully, but ensure you only use the token in `onMounted` or interaction handlers if relying on client-side cookies.
