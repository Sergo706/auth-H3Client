# lockAsyncAction

`lockAsyncAction` is a concurrency utility that prevents race conditions by "locking" an async operation based on a key. If multiple requests with the same key arrive simultaneously, they are executed sequentially (or efficiently awaited) rather than in parallel.

## Usage

```typescript
import { lockAsyncAction } from 'auth-h3client/v1';

const userId = 'user:123';

// 1. First call starts the work
const result1 = await lockAsyncAction(userId, async () => {
   // Heavy database operation or API call
   return await db.getUser(userId);
});

// 2. Second call AWAITS the first call's promise
// It does NOT run the callback again.
const result2 = await lockAsyncAction(userId, async () => {
   return await db.getUser(userId);
});

console.log(result1 === result2); // true
```

## Mechanics

1.  **Check**: Is there an active Promise for `key`?
2.  **Join**: If yes, return that Promise.
3.  **Start**: If no, execute the callback and store the Promise.
4.  **Cleanup**: When the Promise resolves or rejects, remove it from the map.
