# defineDeduplicatedEventHandler

Arguments: `handler` (EventHandler), `lockKey?` (string)

Wraps an event handler to prevent race conditions by serializing concurrent requests from the same user. If multiple requests arrive simultaneously for the same session, they are executed one by one (or waited upon) rather than in parallel.

This is critical for actions that modify state which subsequent requests depend on, such as **token rotation**, payments, or inventory updates.

## Usage

```ts
import { defineDeduplicatedEventHandler } from 'auth-h3client/v1'; // or v2

export default defineDeduplicatedEventHandler(async (event) => {
  // Safe to perform critical operations
  return await doSomethingCritical();
});
```

## Locking Mechanism

The wrapper automatically determines the lock key based on the most specific identifier available, in this order:

1.  **`lockKey`** (if provided as the second argument)
2.  **`session` cookie** (authenticated users)
3.  **`__Secure-a` cookie** (access token)
4.  **`canary_id` cookie** (anonymous visitors with a tracked device)
5.  **`'anon'`** (fallback, though usually `canary_id` covers visitors)
