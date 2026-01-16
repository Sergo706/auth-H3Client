# defineAuthenticatedEventPostHandlers

A convenience wrapper that combines authentication, CSRF verification, and POST method enforcement into a single handler wrapper. Ideal for mutation endpoints.

## Import

```ts
// H3 v1
import { defineAuthenticatedEventPostHandlers } from 'auth-h3client/v1';

// H3 v2
import { defineAuthenticatedEventPostHandlers } from 'auth-h3client/v2';
```

## Signature

```ts
function defineAuthenticatedEventPostHandlers<T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>,
  options: AuthOptions
): EventHandler<T, Promise<D | MfaResponse>>
```

### Options

```ts
interface AuthOptions {
  storage: Storage;      // unstorage instance for caching user data
  cache?: CacheOptions;  // optional cache TTL settings
}
```

---

## What It Does

This wrapper chains three layers of protection:

```
Request
   │
   ▼
┌─────────────────────────────────┐
│ 1. defineAuthenticatedEvent     │  ← Authentication + Token validation
│    Handler                      │
└─────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────┐
│ 2. defineVerifiedCsrfHandler    │  ← CSRF token verification
└─────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────┐
│ 3. assertMethod(event, 'POST')  │  ← POST method enforcement
└─────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────┐
│ Your Handler                    │
└─────────────────────────────────┘
```

### Equivalent Manual Setup

```ts
// This:
defineAuthenticatedEventPostHandlers(handler, options)

// Is equivalent to:
defineAuthenticatedEventHandler(
  defineVerifiedCsrfHandler(
    defineEventHandler((event) => {
      assertMethod(event, 'POST');
      return handler(event);
    })
  ),
  options
)
```

---

## Usage

### Basic Usage

```ts
import { defineAuthenticatedEventPostHandlers } from 'auth-h3client/v1';
import { useStorage } from '#imports';
import { readBody } from 'h3';

export default defineAuthenticatedEventPostHandlers(
  async (event) => {
    const user = event.context.authorizedData!;
    const body = await readBody(event);
    
    const post = await db.posts.create({
      data: {
        title: body.title,
        content: body.content,
        authorId: user.userId
      }
    });
    
    return { success: true, postId: post.id };
  },
  { storage: useStorage('cache') }
);
```

### Form Submission

```ts
// server/api/settings.post.ts
import { defineAuthenticatedEventPostHandlers } from 'auth-h3client/v1';
import { useStorage } from '#imports';
import { readBody } from 'h3';

export default defineAuthenticatedEventPostHandlers(
  async (event) => {
    const user = event.context.authorizedData!;
    const { displayName, bio, notifications } = await readBody(event);
    
    await db.users.update({
      where: { id: user.userId },
      data: { displayName, bio, notifications }
    });
    
    return { success: true, message: 'Settings updated' };
  },
  { storage: useStorage('cache') }
);
```

---

## Security Layers

### 1. Authentication

- Validates access token and session cookies
- Checks with auth service (cached)
- Sets `event.context.authorizedData`
- Throws 401 if unauthorized

### 2. CSRF Verification

- Calls `verifyCsrfCookie(event)`
- Validates CSRF token from request matches cookie
- Protects against cross-site request forgery

### 3. POST Method

- Enforces HTTP POST method
- Returns 405 Method Not Allowed for other methods

---

## Client-Side Requirements

Your frontend must:

1. **Include CSRF token** in the request (header or body)
2. **Send cookies** with the request
3. **Use POST method**

### Example: Nuxt/Vue Client

```ts
// Assuming CSRF cookie is set by generateCsrfCookie middleware
const csrfToken = useCookie('csrf_token');

await $fetch('/api/posts', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken.value
  },
  body: {
    title: 'My Post',
    content: 'Hello world'
  }
});
```

---

## Error Responses

| Error | Status | Cause |
|-------|--------|-------|
| Unauthorized | 401 | Missing/invalid credentials |
| CSRF Invalid | 403 | Missing/invalid CSRF token |
| Method Not Allowed | 405 | Not a POST request |
| MFA Required | 202 | User needs MFA verification |
| Rate Limited | 429 | Too many requests |

---

## Example: Delete Action

```ts
// server/api/posts/[id].delete.ts
// Note: Even for "delete" actions, use POST for CSRF protection

import { defineAuthenticatedEventPostHandlers } from 'auth-h3client/v1';
import { useStorage } from '#imports';
import { getRouterParam } from 'h3';

export default defineAuthenticatedEventPostHandlers(
  async (event) => {
    const user = event.context.authorizedData!;
    const postId = getRouterParam(event, 'id');
    
    // Verify ownership
    const post = await db.posts.findUnique({ where: { id: postId } });
    
    if (!post || post.authorId !== user.userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' });
    }
    
    await db.posts.delete({ where: { id: postId } });
    
    return { success: true, deleted: postId };
  },
  { storage: useStorage('cache') }
);
```

## Example: File Upload

```ts
// server/api/upload.post.ts
import { defineAuthenticatedEventPostHandlers } from 'auth-h3client/v1';
import { useStorage } from '#imports';
import { readMultipartFormData } from 'h3';

export default defineAuthenticatedEventPostHandlers(
  async (event) => {
    const user = event.context.authorizedData!;
    const formData = await readMultipartFormData(event);
    
    const file = formData?.find(f => f.name === 'file');
    if (!file) {
      throw createError({ statusCode: 400, message: 'No file provided' });
    }
    
    const url = await uploadToStorage(file.data, {
      userId: user.userId,
      filename: file.filename
    });
    
    return { success: true, url };
  },
  { storage: useStorage('cache') }
);
```

---

## See Also

- [defineAuthenticatedEventHandler](./defineAuthenticatedEventHandler.md) - Authentication only
- [defineVerifiedCsrfHandler](./csrfVerifier.md) - CSRF verification only
- [defineOptionalAuthenticationEvent](./defineOptionalAuth.md) - Optional authentication
