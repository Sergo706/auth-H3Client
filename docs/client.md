# Client-Side Authentication & Data Fetching

The client-side library is designed to solve the "Token Rotation Race Condition" (401 loops) through a **Singleton Gatekeeper** pattern.

It ensures that **no API request is ever sent** unless the authentication state is known to be valid and fresh. If a token rotation is required (e.g., after 15 minutes), the library pauses all outgoing requests, performs the rotation once, updates the cookies, and then releases the requests.

---

## 1. Setup (Nuxt Wiring)

To guarantee race-condition-free navigation, you must initialize the Gatekeeper at two points in your Nuxt application.

### A. Initial Load (`app.vue`)
This protects the application on the very first page load (SSR or SPA entry). It ensures the session is valid before any child component attempts to fetch data.

```vue
<script setup lang="ts">
import { useAuthData } from 'auth-h3client/nuxt';

// 1. GLOBAL GATEKEEPER
// This awaits the singleton lock. It pauses the app mounting until
// the token rotation (if needed) is complete.
await useAuthData(); 
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

```

### B. Client-Side Navigation (`middleware`)

This protects the application when the user clicks links to navigate. If the token expires while the user is reading a page, this middleware rotates it *before* the next page loads its data.

Create `middleware/auth-check.global.ts`:

```typescript
import { useAuthData } from "auth-h3client/nuxt";

export default defineNuxtRouteMiddleware(async () => {
  // Skip on server (app.vue handled it)
  if (import.meta.server) return;
  
  // On client navigation, ensure auth is fresh before entering the route
  await useAuthData();
});

```

---

## 2. Creating API Services (`AuthBase`)

Your API service classes should extend `AuthBase`. This gives them access to the `waitForAuth()` lock and the `authFetch()` wrapper.

### The Patterns

There are three ways to use the library depending on the endpoint security level.

#### Pattern 1: Strict Authentication (Fail Fast)

Use this for endpoints that **require** a user (e.g., `getPrivateAvatar`, `getBilling`).

**Why `waitForAuth`?**
We manually check `auth.authorized` to stop execution locally. This saves a network round-trip. If we didn't check, `authFetch` would send the request, and the server would return a 401.

```typescript
import AuthBase from 'auth-h3client/client';
import type { Results } from '~~/shared/types';

export default class Profiles extends AuthBase {
    
    async getPrivateAvatar() {
        // 1. GATEKEEPER: Wait for rotation & Get State
        const auth = await this.waitForAuth(); 

        // 2. FAIL FAST optimization
        // Stop execution here if not logged in. 
        // Prevents sending a request we know will fail.
        if (!auth.authorized) {
            return { ok: false, reason: 'Not allowed' };
        }

        // 3. SAFE FETCH
        // Cookies are guaranteed fresh.
        return await this.authFetch<Results<any>>('/api/users/private-avatar');
    }
}

```

#### Pattern 2: Optional Authentication (Personalized)

Use this for endpoints that work for both Guests and Users (e.g., `getPost`, `getAuthorById`). The server returns different data if a user is logged in.

**Why `waitForAuth`?**
Even though we don't block guests, we **must wait** for the lock. If we didn't, a "Guest" request might fire while a "Token Rotation" is happening in the background, causing a race condition on the server.

```typescript
async getAuthorById(id: number) {
    // 1. GATEKEEPER: Wait for any pending rotation.
    // We do NOT check "if (!authorized) return" because guests are allowed.
    await this.waitForAuth(); 
    
    // 2. FETCH
    // If logged in: Sends fresh cookies -> Personalized response
    // If guest: Sends no cookies -> Generic response
    return await this.authFetch<Results<any>>(`/api/authors/${id}`);
}

```

#### Pattern 3: Pure Public Data

For endpoints that **never** touch user data (e.g., `getSystemStatus`, `getTags`).

```typescript
async getTags() {
    // No auth check needed because the server handler ignores cookies.
    // However, using authFetch is still recommended for consistency.
    return await this.authFetch<Results<string[]>>('/api/tags');
}

```

---

## 3. API Reference

### `useAuthData()` (Composable)

* **Returns:** `Promise<Ref<AuthState>>`
* **Behavior:**
* **Singleton:** If called 10 times simultaneously, it sends **1 network request**.
* **SSR Safe:** Deduplication logic only runs on the client.
* **Reactive:** Updates the global `useState('auth')`.



### `AuthBase` (Class)

#### `waitForAuth(): Promise<AuthState>`

* Waits for the singleton lock to resolve.
* Returns the current authentication state (`authorized`, `userId`, `roles`).
* **Cost:** 0ms (memory lookup) if the check was already performed by `app.vue` or middleware.

#### `authFetch<T>(url, options): Promise<T>`

#### `authFetch(url, prefix: true, options): Promise<$Fetch>`

* Wraps `$fetch` (ofetch).
* **Guarantees:** The request will **never** be sent until the authentication status is settled and tokens are rotated.
* **Prefix Overload:** If `prefix: true` is passed, it returns a `$fetch.create` instance with the base URL and headers pre-configured, useful for creating sub-services.

---

## 4. Why "Fail Fast"?

You might notice that `authFetch` internally calls `waitForAuth`. So why do we call it manually in **Pattern 1**?

**Without Fail Fast:**

1. Component calls `authFetch('/api/private')`.
2. `authFetch` waits for rotation. Result: "User is logged out".
3. `authFetch` sends request to server anyway.
4. Server processes request -> Returns **401 Unauthorized**.
5. Client handles error.
*(Result: Wasted bandwidth and server CPU)*

**With Fail Fast:**

1. Component calls `waitForAuth()`.
2. Result: "User is logged out".
3. Code returns early: `if (!authorized) return`.
4. **No request is sent to the server.**
*(Result: Instant UI feedback, zero server load)*

Because of the Singleton Lock, calling `waitForAuth` twice (once manually, once inside `authFetch`) costs **zero** extra network requests.
