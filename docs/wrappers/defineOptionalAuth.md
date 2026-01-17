# defineOptionalAuthenticationEvent

A higher-order function that wraps H3 event handlers with **optional** authentication. If authentication fails, the handler proceeds as a guest instead of throwing an error.

## Import

```ts
// H3 v1
import { defineOptionalAuthenticationEvent } from 'auth-h3client/v1';

// H3 v2
import { defineOptionalAuthenticationEvent } from 'auth-h3client/v2';
```

## Signature

```ts
function defineOptionalAuthenticationEvent<T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>
): EventHandler<T, Promise<D>>
```

> **Note**: Storage and cache options are now configured globally via `configuration()`. See [Configuration Guide](../configuration.md#storage-settings-ustorage).

---

## Usage

### Basic Usage

```ts
import { defineOptionalAuthenticationEvent } from 'auth-h3client/v1';

export default defineOptionalAuthenticationEvent((event) => {
  const user = event.context.authorizedData;
  
  if (user) {
    // Authenticated user
    return { greeting: `Hello ${user.userId}!`, guest: false };
  }
  
  // Guest user
  return { greeting: 'Hello guest!', guest: true };
});
```

### Conditional Content

```ts
export default defineOptionalAuthenticationEvent(async (event) => {
  const user = event.context.authorizedData;
  
  const posts = await db.posts.findMany({
    where: { published: true }
  });
  
  // Add private data only for authenticated users
  if (user) {
    return {
      posts,
      bookmarks: await db.bookmarks.findMany({ userId: user.userId }),
      canEdit: true
    };
  }
  
  return { posts, canEdit: false };
});
```

---

## Behavior

### Authentication Success

When authentication succeeds:
- `event.context.authorizedData` contains the user's `ServerResponse`
- Handler executes with user data available

### Authentication Failure

When authentication fails (missing tokens, invalid credentials, MFA required, etc.):
- `event.context.authorizedData` is set to `undefined`
- Handler executes normally (no error thrown)
- Failure is logged as info: `'Optional auth failed, proceeding as guest'`

### Rate Limiting Exception

**Important**: Rate limit errors (429) are **not** caught. They will still throw to prevent abuse:

```ts
// This WILL throw if rate limited
if (result.status === 429) {
  appendHeader(event, 'Retry-After', result.retryAfter);
  throwHttpError(log, event, 'FORBIDDEN', 429, 'To many requests', '...');
}
```

---

## Flow Diagram

```
Request
   │
   ▼
┌─────────────────────┐
│ HMAC Signature      │
│ Token Validation    │
│ Cookie Check        │
└─────────────────────┘
   │
   ▼
┌─────────────────────┐
│ Get Cached User     │◄─── Cache hit? Return cached
│ Data                │
└─────────────────────┘
   │
   ▼
┌─────────────────────┐
│ Auth Success?       │
└─────────────────────┘
   │           │
  YES         NO
   │           │
   ▼           ▼
┌─────────┐ ┌─────────────────┐
│ Set     │ │ Set             │
│ user    │ │ authorizedData  │
│ data    │ │ = undefined     │
└─────────┘ └─────────────────┘
   │           │
   └─────┬─────┘
         │
         ▼
   ┌───────────┐
   │  Handler  │
   └───────────┘
```

---

## Comparison with defineAuthenticatedEventHandler

| Feature | `defineAuthenticatedEventHandler` | `defineOptionalAuthenticationEvent` |
|---------|-----------------------------------|-------------------------------------|
| Auth failure | Throws 401 error | Proceeds with `undefined` user |
| MFA required | Returns 202 response | Proceeds with `undefined` user |
| Rate limit | Throws 429 error | Throws 429 error |
| Use case | Protected routes | Public routes with optional personalization |

---

## Example: Public Feed with Personalization

```ts
// server/api/feed.get.ts
import { defineOptionalAuthenticationEvent } from 'auth-h3client/v1';

export default defineOptionalAuthenticationEvent(async (event) => {
  const user = event.context.authorizedData;
  
  // Base query for public posts
  const posts = await db.posts.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  if (user) {
    // Personalize for authenticated users
    const following = await db.follows.findMany({
      where: { followerId: user.userId }
    });
    
    const followingIds = following.map(f => f.followingId);
    
    return {
      posts: posts.map(p => ({
        ...p,
        isFollowing: followingIds.includes(p.authorId),
        canBookmark: true
      })),
      isAuthenticated: true
    };
  }
  
  return {
    posts,
    isAuthenticated: false
  };
});
```

## Example: Preview vs Full Content

```ts
// server/api/articles/[id].get.ts
import { defineOptionalAuthenticationEvent } from 'auth-h3client/v1';
import { getRouterParam } from 'h3';

export default defineOptionalAuthenticationEvent(async (event) => {
  const id = getRouterParam(event, 'id');
  const user = event.context.authorizedData;
  
  const article = await db.articles.findUnique({ where: { id } });
  
  if (!article) {
    throw createError({ statusCode: 404, message: 'Article not found' });
  }
  
  // Premium content: show preview for guests, full for authenticated
  if (article.premium && !user) {
    return {
      ...article,
      content: article.content.slice(0, 500) + '...',
      preview: true,
      message: 'Sign in to read the full article'
    };
  }
  
  return { ...article, preview: false };
});
```

---

## See Also

- [defineAuthenticatedEventHandler](./defineAuthenticatedEventHandler.md) - Required authentication wrapper
- [defineAuthenticatedEventPostHandlers](./authenticatedPostHandler.md) - POST + CSRF + Auth combined
- [getCachedUserData](./getCachedUserData.md) - Low-level user data fetching
