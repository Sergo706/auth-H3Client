# getCachedUserData

A low-level utility function that fetches user authentication data from the auth service, with built-in caching. This is the core function used internally by the auth wrappers.

## Import

```ts
// H3 v1
import { getCachedUserData } from 'auth-h3client/v1';

// H3 v2
import { getCachedUserData } from 'auth-h3client/v2';
```

## Signature

```ts
function getCachedUserData(
  event: H3Event,
  cookies: Cookies[],
  token: string,
  storage: Storage,
  cacheOptions?: CacheOptions
): Promise<CachedAuthResponse>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `event` | `H3Event` | The H3 event object |
| `cookies` | `Cookies[]` | Array of cookies to send to auth service |
| `token` | `string` | Access token for authentication |
| `storage` | `Storage` | unstorage instance for caching |
| `cacheOptions` | `CacheOptions?` | Optional cache TTL settings |

### Types

```ts
interface Cookies {
  label: string;
  value: string;
}

interface CacheOptions {
  successTtl?: number;     // Default: 2592000 (30 days)
  rateLimitTtl?: number;   // Default: 10 seconds
}

type CachedAuthResponse = 
  | { type: 'SUCCESS'; data: ServerResponse }
  | { type: 'ERROR'; status: number; reason: string; msg: string; retryAfter?: number };
```

---

## Usage

> **Note**: In most cases, use the higher-level wrappers like `defineAuthenticatedEventHandler` instead. Use this function directly only for custom auth flows.

### Basic Usage

```ts
import { getCachedUserData } from 'auth-h3client/v1';
import { getCookie } from 'h3';
import { useStorage } from '#imports';

export default defineEventHandler(async (event) => {
  const token = event.context.accessToken;
  const session = getCookie(event, 'session');
  const canary = getCookie(event, 'canary_id');
  
  if (!token || !session || !canary) {
    throw createError({ statusCode: 401 });
  }
  
  const cookies = [
    { label: 'session', value: session },
    { label: 'canary_id', value: canary }
  ];
  
  const result = await getCachedUserData(
    event,
    cookies,
    token,
    useStorage('cache')
  );
  
  if (result.type === 'ERROR') {
    throw createError({ statusCode: result.status, message: result.msg });
  }
  
  return result.data;
});
```

### With Custom Cache TTL

```ts
const result = await getCachedUserData(
  event,
  cookies,
  token,
  useStorage('cache'),
  {
    successTtl: 60 * 60,      // 1 hour
    rateLimitTtl: 30          // 30 seconds
  }
);
```

---

## How It Works

```
getCachedUserData()
        │
        ▼
┌───────────────────────┐
│ Generate cache key    │
│ (SHA256 hash of       │
│ canary + session +    │
│ token)                │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Check cache           │──── Hit ──▶ Return cached data
└───────────────────────┘
        │ Miss
        ▼
┌───────────────────────┐
│ Call auth service     │
│ serviceToService(     │
│   '/secret/data'      │
│ )                     │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Handle response       │
│ - 200: Cache & return │
│ - 202: MFA required   │
│ - 401: Unauthorized   │
│ - 429: Rate limited   │
│ - 500: Server error   │
└───────────────────────┘
```

---

## Response Handling

### Success Response

```ts
{
  type: 'SUCCESS',
  data: {
    authorized: true,
    userId: '123',
    roles: ['user', 'admin'],
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    date: '2024-01-16T12:00:00Z'
  }
}
```

### Error Responses

| Status | Reason | Description |
|--------|--------|-------------|
| 500 | `SERVER_ERROR` | Auth service unreachable or null response |
| 429 | `RATE_LIMIT` | Too many requests, includes `retryAfter` |
| 202 | `MFA` | Multi-factor authentication required |
| 401 | `UNAUTHORIZED` | User not authorized or roles missing |
| Other | `DETAILED_SERVER_ERROR` | API call failed with error details |

```ts
// Rate limit example
{
  type: 'ERROR',
  status: 429,
  reason: 'RATE_LIMIT',
  msg: '60',           // Retry-After value
  retryAfter: 60       // Seconds to wait
}

// MFA example
{
  type: 'ERROR',
  status: 202,
  reason: 'MFA',
  msg: 'Please verify your email'
}

// Unauthorized example
{
  type: 'ERROR',
  status: 401,
  reason: 'UNAUTHORIZED',
  msg: 'user is not authorized...'
}
```

---

## Caching

### Cache Key Generation

The cache key is a SHA256 hash of:
```
auth:user:{canary_id}:{session}:{token}
```

This ensures:
- Different users have different cache entries
- Token rotation invalidates cache
- Session changes invalidate cache

### Cache Storage

Uses `unstorage` for flexible storage backends:

```ts
// Memory (development)
import { createStorage } from 'unstorage';
const storage = createStorage();

// Redis (production)
import redisDriver from 'unstorage/drivers/redis';
const storage = createStorage({
  driver: redisDriver({ url: 'redis://localhost:6379' })
});

// Nuxt nitro
const storage = useStorage('cache');
```

### Cache TTL

| Type | Default | Description |
|------|---------|-------------|
| Success | 30 days | How long to cache valid auth data |
| Rate Limit | 10 seconds | How long to cache rate limit response |

---

## Example: Custom Auth Middleware

```ts
// server/middleware/custom-auth.ts
import { getCachedUserData } from 'auth-h3client/v1';
import { getCookie, createError } from 'h3';
import { useStorage } from '#imports';

export default defineEventHandler(async (event) => {
  // Skip for public paths
  if (event.path.startsWith('/api/public')) return;
  
  const token = event.context.accessToken;
  const session = getCookie(event, 'session');
  const canary = getCookie(event, 'canary_id');
  
  if (!token || !session || !canary) {
    // Allow through but mark as unauthenticated
    event.context.user = null;
    return;
  }
  
  const cookies = [
    { label: 'session', value: session },
    { label: 'canary_id', value: canary }
  ];
  
  const result = await getCachedUserData(
    event, cookies, token, useStorage('cache')
  );
  
  if (result.type === 'SUCCESS') {
    event.context.user = result.data;
  } else {
    event.context.user = null;
    event.context.authError = result;
  }
});
```

## Example: Rate Limit Handling

```ts
import { getCachedUserData } from 'auth-h3client/v1';
import { setResponseHeader } from 'h3';

const result = await getCachedUserData(event, cookies, token, storage);

if (result.type === 'ERROR') {
  if (result.reason === 'RATE_LIMIT') {
    setResponseHeader(event, 'Retry-After', String(result.retryAfter));
    throw createError({
      statusCode: 429,
      message: 'Too many requests. Please try again later.'
    });
  }
  
  if (result.reason === 'MFA') {
    // Redirect to MFA page or return MFA required response
    return { mfaRequired: true, message: result.msg };
  }
  
  throw createError({ statusCode: result.status, message: result.msg });
}
```

---

## See Also

- [defineAuthenticatedEventHandler](./defineAuthenticatedEventHandler.md) - High-level auth wrapper
- [defineOptionalAuthenticationEvent](./defineOptionalAuth.md) - Optional auth wrapper
- [Server to Server](../server-to-server.md) - How `serviceToService` works
- [Token Rotation](../token-rotation.md) - Token refresh flow
