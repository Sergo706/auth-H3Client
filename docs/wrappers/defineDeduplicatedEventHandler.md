# Request Deduplication

`defineDeduplicatedEventHandler` is a wrapper that serializes concurrent requests for the same user. This prevents race conditions in critical flows like payments, inventory checks, or token rotation.

## How it works

It uses an **In-Memory Lock** (Promise mapping) to ensure that if User A sends Requests 1, 2, and 3 simultaneously, they run in order (or wait for the first to complete), rather than running in parallel.

### Locking Priority

The wrapper determines the "Lock Key" (User Identity) using the following priority:

1.  **Custom `lockKey`**: If you passed a specific key (e.g., `'system-maintenance'`).
2.  **`session` cookie**: The Refresh Token (Authenticated User).
3.  **`__Secure-a` cookie**: The Access Token (Authenticated User).
4.  **`canary_id` cookie**: The Visitor ID (Unauthenticated Visitor).
5.  **`'anon'`**: Fallback.

> [!NOTE]
> If the key resolves to `'anon'` (no cookies found), the lock is **skipped**. Anonymous requests run in parallel.

## Usage

```typescript
import { defineDeduplicatedEventHandler } from 'auth-h3client/v1';

export default defineDeduplicatedEventHandler(async (event) => {
  // Safe Zone: Only one request per user can be here at a time.
  
  const balance = await getBalance(event.context.auth.id);
  if (balance >= 10) {
    await deductBalance(event.context.auth.id, 10);
    return { success: true };
  }
});
```

### Custom Locking Group

You can force a global lock or a group lock by passing a string.

```typescript
// Locks EVERYONE globally (use with caution!)
export default defineDeduplicatedEventHandler(handler, 'global-lock');
```
