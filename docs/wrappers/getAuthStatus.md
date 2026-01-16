# getAuthStatusHandler

A factory function that creates a pre-built authenticated endpoint for checking user auth status. Returns the user's authentication data if authenticated.

## Import

```ts
// H3 v1
import { getAuthStatusHandler } from 'auth-h3client/v1';

// H3 v2
import { getAuthStatusHandler } from 'auth-h3client/v2';
```

## Signature

```ts
function getAuthStatusHandler(storage: Storage): EventHandler
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `storage` | `Storage` | unstorage instance for caching user data |

---

## Usage

### Basic Setup

```ts
// server/api/auth/status.get.ts
import { getAuthStatusHandler } from 'auth-h3client/v1';
import { useStorage } from '#imports';

export default getAuthStatusHandler(useStorage('cache'));
```

That's it! The handler is ready to use.

---

## Response

### Authenticated User

```json
{
  "authenticated": true,
  "userId": 123,
  "roles": ["user", "admin"],
  "authorized": true,
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "date": "2024-01-16T12:00:00Z"
}
```

### Error Responses

| Status | Response | Cause |
|--------|----------|-------|
| 401 | `UnAuthorized` | No valid credentials |
| 400 | `Bad request` | userId parsing failed |
| 202 | `{ mfaRequired: '...', message: '...' }` | MFA required |
| 429 | Rate limited | Too many requests |

---

## What It Does

The handler:

1. Wraps with `defineAuthenticatedEventHandler` for full auth
2. Logs the auth status check
3. Validates user data exists
4. Parses and validates userId as number
5. Returns combined user data with `authenticated: true`

### Implementation

```ts
export const getAuthStatusHandler = (storage: Storage) => {
  return defineAuthenticatedEventHandler(
    (event) => {
      const user = event.context.authorizedData;
      
      if (!user) {
        throwHttpError(log, event, 'AUTH_REQUIRED', 401, 'UnAuthorized', ...);
      }

      const id = Number(user.userId);
      if (!id) {
        throwHttpError(log, event, 'AUTH_CLIENT_ERROR', 400, 'Bad request', ...);
      }

      return {
        authenticated: true,
        userId: id,
        roles: user.roles,
        ...user
      };
    },
    { storage }
  );
};
```

---

## Client Usage

### Nuxt/Vue

```ts
// composables/useAuth.ts
export const useAuth = async () => {
  const { data, error } = await useFetch('/api/auth/status');
  
  if (error.value || !data.value?.authenticated) {
    return { authenticated: false, user: null };
  }
  
  return {
    authenticated: true,
    user: data.value
  };
};
```

### With useAuthData Composable

The `useAuthData` composable from `auth-h3client/client` is designed to call this endpoint:

```ts
import { useAuthData } from 'auth-h3client/client';

// Calls /users/authStatus by default
const auth = await useAuthData();

// Or with custom endpoint
const auth = await useAuthData('/api/auth/status');
```

---

## Example: Nuxt Middleware

```ts
// middleware/auth.global.ts
export default defineNuxtRouteMiddleware(async (to) => {
  // Skip for public routes
  if (to.meta.public) return;
  
  try {
    const { data } = await useFetch('/api/auth/status');
    
    if (!data.value?.authenticated) {
      return navigateTo('/login');
    }
    
    if (data.value.mfaRequired) {
      return navigateTo('/mfa');
    }
  } catch {
    return navigateTo('/login');
  }
});
```

## Example: Role Check

```ts
// composables/useAuthGuard.ts
export const useAuthGuard = async (requiredRoles: string[]) => {
  const { data } = await useFetch('/api/auth/status');
  
  if (!data.value?.authenticated) {
    throw createError({ statusCode: 401, message: 'Not authenticated' });
  }
  
  const userRoles = Array.isArray(data.value.roles) 
    ? data.value.roles 
    : [data.value.roles];
  
  const hasRole = requiredRoles.some(r => userRoles.includes(r));
  
  if (!hasRole) {
    throw createError({ statusCode: 403, message: 'Insufficient permissions' });
  }
  
  return data.value;
};

// Usage in page
const user = await useAuthGuard(['admin']);
```

---

## Customization

If you need different behavior, use `defineAuthenticatedEventHandler` directly:

```ts
// server/api/auth/me.get.ts
import { defineAuthenticatedEventHandler } from 'auth-h3client/v1';
import { useStorage } from '#imports';

export default defineAuthenticatedEventHandler(
  async (event) => {
    const user = event.context.authorizedData!;
    
    // Fetch additional profile data
    const profile = await db.profiles.findUnique({
      where: { userId: user.userId }
    });
    
    return {
      id: user.userId,
      roles: user.roles,
      profile: {
        displayName: profile?.displayName,
        avatar: profile?.avatar
      }
    };
  },
  { storage: useStorage('cache') }
);
```

---

## See Also

- [defineAuthenticatedEventHandler](./defineAuthenticatedEventHandler.md) - Build custom auth endpoints
- [Client Package](../client.md) - `useAuthData` composable
- [Token Rotation](../token-rotation.md) - How token refresh works
