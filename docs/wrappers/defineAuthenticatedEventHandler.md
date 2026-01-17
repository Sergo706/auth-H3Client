# defineAuthenticatedEventHandler

A higher-order function that wraps H3 event handlers with authentication, token validation, and user data caching.

## Import

```ts
// H3 v1
import { defineAuthenticatedEventHandler } from 'auth-h3client/v1';

// H3 v2
import { defineAuthenticatedEventHandler } from 'auth-h3client/v2';
```

## Signature

```ts
function defineAuthenticatedEventHandler<T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>
): EventHandler<T, Promise<D | MfaResponse>>
```

> **Note**: Storage and cache options are now configured globally via `configuration()`. See [Configuration Guide](../configuration.md#storage-settings-ustorage).

### Return Types

```ts
// On MFA required (status 202)
interface MfaResponse {
  mfaRequired: string;
  message: string;
}
```

---

## Usage

### Basic Usage

```ts
import { defineAuthenticatedEventHandler } from 'auth-h3client/v1';

export default defineAuthenticatedEventHandler((event) => {
  // User is authenticated here
  const user = event.context.authorizedData;
  
  return {
    message: `Hello ${user.userId}!`,
    roles: user.roles
  };
});
```



### Accessing User Data

The authenticated user data is available on `event.context.authorizedData`:

```ts
interface ServerResponse {
  authorized: boolean;
  userId?: string;
  reason?: string;
  ipAddress: string;
  userAgent: string;
  date: string;
  roles?: string[] | string;
  error?: string;
  message?: string;
}
```

```ts
export default defineAuthenticatedEventHandler((event) => {
  const user = event.context.authorizedData!;
  
  // Check roles
  const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
  if (!roles.includes('admin')) {
    throw createError({ statusCode: 403, message: 'Admin required' });
  }
  
  return { admin: true };
});
```

---

## Authentication Flow

1. **HMAC Signature Verification**: Validates request signature
2. **Credential Validation**: Calls `ensureValidCredentials` to rotate tokens if needed
3. **Cookie Extraction**: Gets `session`, `canary_id` cookies and access token
4. **User Data Fetch**: Calls auth service via `getCachedUserData`
5. **Cache Check**: Returns cached data if available
6. **Handler Execution**: Runs your handler with `event.context.authorizedData` set

```
Request → HMAC Check → Token Rotation → Cookie Check → Cache/API → Handler
```

---

## Response Handling

| Scenario | Status | Response |
|----------|--------|----------|
| Success | 200 | Handler return value |
| MFA Required | 202 | `{ mfaRequired: 'MFA required', message: '...' }` |
| Unauthorized | 401 | Error thrown |
| Rate Limited | 429 | Error with `Retry-After` header |
| Server Error | 500 | Error thrown |

---

## Required Cookies

The handler expects these cookies to be present:

| Cookie | Description |
|--------|-------------|
| `session` | Refresh token / session cookie |
| `canary_id` | Canary cookie for session binding |

Access token is expected on `event.context.accessToken` (set by `ensureValidCredentials`).

---

## Error Handling

Errors are thrown using `throwHttpError` with structured error codes:

```ts
// Missing credentials
throwHttpError(log, event, 'FORBIDDEN', 401, 'UnAuthorized', '...');

// Rate limited
throwHttpError(log, event, 'FORBIDDEN', 429, 'To many requests', '...');

// Server error
throwHttpError(log, event, 'SERVER_ERROR', 500, 'Server error', '...');
```

---

## Example: Protected API Route

```ts
// server/api/profile.get.ts
import { defineAuthenticatedEventHandler } from 'auth-h3client/v1';

export default defineAuthenticatedEventHandler(async (event) => {
  const user = event.context.authorizedData!;
  
  // Fetch additional profile data from database
  const profile = await db.profiles.findUnique({
    where: { userId: user.userId }
  });
  
  return {
    id: user.userId,
    roles: user.roles,
    ...profile
  };
});
```

## Example: Role-Based Access

```ts
// server/api/admin/users.get.ts
import { defineAuthenticatedEventHandler } from 'auth-h3client/v1';
import { createError } from 'h3';

export default defineAuthenticatedEventHandler(async (event) => {
  const user = event.context.authorizedData!;
  const roles = Array.isArray(user.roles) ? user.roles : [user.roles].filter(Boolean);
  
  if (!roles.includes('admin')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Admin role required'
    });
  }
  
  return await db.users.findMany();
});
```

---

## See Also

- [defineOptionalAuthenticationEvent](./defineOptionalAuth.md) - Optional authentication wrapper
- [defineAuthenticatedEventPostHandlers](./authenticatedPostHandler.md) - POST + CSRF + Auth combined
- [getAuthStatusHandler](./getAuthStatus.md) - Pre-built auth status endpoint
- [getCachedUserData](./getCachedUserData.md) - Low-level user data fetching
