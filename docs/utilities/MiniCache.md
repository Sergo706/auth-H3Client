# MiniCache

`MiniCache` is a lightweight, in-memory Key-Value store with Time-To-Live (TTL) support. It is used internally for caching user sessions and metadata to reduce database hits.

## Usage

```typescript
import { MiniCache } from 'auth-h3client/v1';

const cache = new MiniCache();

// Set with TTL (ms)
cache.set('user:123', { name: 'Alice' }, 60 * 1000);

// Get
const user = cache.get('user:123'); // { name: 'Alice' } or null

// Check existence
if (cache.has('user:123')) {
  // ...
}

// Delete
cache.del('user:123');
```

## API

### `set(key: string, value: any, ttl?: number)`
Stores a value. `ttl` is in milliseconds. If omitted, the value persists indefinitely (until process restart or memory clear).

### `get(key: string)`
Retrieves a value. Returns `null` if the key does not exist or has expired.

### `has(key: string)`
Returns `true` if the key exists and is valid.

### `del(key: string)`
Removes the key immediately.
