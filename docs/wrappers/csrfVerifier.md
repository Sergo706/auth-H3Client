# defineVerifiedCsrfHandler

A wrapper that adds CSRF (Cross-Site Request Forgery) verification to any H3 event handler. Use this to protect state-changing endpoints from CSRF attacks.

## Import

```ts
// H3 v1
import { defineVerifiedCsrfHandler } from 'auth-h3client/v1';

// H3 v2
import { defineVerifiedCsrfHandler } from 'auth-h3client/v2';
```

## Signature

```ts
function defineVerifiedCsrfHandler<T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>
): EventHandler<T, Promise<D>>
```

---

## Usage

### Basic Usage

```ts
import { defineVerifiedCsrfHandler } from 'auth-h3client/v1';
import { defineEventHandler, readBody } from 'h3';

export default defineVerifiedCsrfHandler(
  defineEventHandler(async (event) => {
    const body = await readBody(event);
    
    // CSRF is verified, safe to process
    await processForm(body);
    
    return { success: true };
  })
);
```

### With Authentication

```ts
import { defineAuthenticatedEventHandler, defineVerifiedCsrfHandler } from 'auth-h3client/v1';
import { useStorage } from '#imports';

export default defineAuthenticatedEventHandler(
  defineVerifiedCsrfHandler(
    defineEventHandler(async (event) => {
      const user = event.context.authorizedData!;
      const body = await readBody(event);
      
      await db.posts.create({
        data: { ...body, authorId: user.userId }
      });
      
      return { success: true };
    })
  ),
  { storage: useStorage('cache') }
);
```

> **Tip**: Use `defineAuthenticatedEventPostHandlers` for auth + CSRF + POST in one wrapper.

---

## How It Works

```
Request
   │
   ▼
┌────────────────────────┐
│ verifyCsrfCookie(event)│
│                        │
│ - Get CSRF token from  │
│   header or body       │
│ - Compare with cookie  │
│ - Throw 403 if invalid │
└────────────────────────┘
   │
   ▼
┌────────────────────────┐
│ Your Handler           │
└────────────────────────┘
```

The wrapper calls `verifyCsrfCookie(event)` which:
1. Extracts CSRF token from request (header `X-CSRF-Token` or body field)
2. Compares it with the CSRF cookie set by `generateCsrfCookie`
3. Throws 403 Forbidden if tokens don't match or are missing

---

## Prerequisites

### 1. Generate CSRF Cookie

Your app must use `generateCsrfCookie` middleware to set the CSRF cookie:

```ts
// server/plugins/csrf.ts (Nuxt)
import { generateCsrfCookie } from 'auth-h3client/v1';

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('request', generateCsrfCookie);
});
```

Or with H3 directly:

```ts
import { createApp } from 'h3';
import { generateCsrfCookie } from 'auth-h3client/v1';

const app = createApp();
app.use(generateCsrfCookie);
```

### 2. Send CSRF Token from Client

Include the CSRF token in your requests:

```ts
// Get token from cookie (Nuxt)
const csrfToken = useCookie('csrf_token');

// OR using the client helper (Vanilla/Other)
import { getCsrfToken } from 'auth-h3client/client';
const token = getCsrfToken();

// Include in request
await $fetch('/api/submit', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken.value
  },
  body: formData
});
```

Or in the request body:

```ts
await $fetch('/api/submit', {
  method: 'POST',
  body: {
    _csrf: csrfToken.value,
    ...formData
  }
});
```

---

## Error Response

When CSRF verification fails:

```
HTTP 403 Forbidden

{
  "statusCode": 403,
  "message": "Invalid CSRF token"
}
```

---

## When to Use

| Endpoint Type | Use CSRF? |
|---------------|-----------|
| GET requests (read-only) | ❌ No |
| POST/PUT/DELETE (mutations) | ✅ Yes |
| API consumed by third parties | ❌ No (use other auth) |
| Same-origin form submissions | ✅ Yes |
| File uploads | ✅ Yes |

---

## Example: Contact Form

```ts
// server/api/contact.post.ts
import { defineVerifiedCsrfHandler } from 'auth-h3client/v1';
import { defineEventHandler, readBody, assertMethod } from 'h3';

export default defineVerifiedCsrfHandler(
  defineEventHandler(async (event) => {
    assertMethod(event, 'POST');
    
    const { name, email, message } = await readBody(event);
    
    await sendEmail({
      to: 'support@example.com',
      subject: `Contact from ${name}`,
      body: message,
      replyTo: email
    });
    
    return { success: true, message: 'Message sent!' };
  })
);
```

### Client

```vue
<script setup>
const csrf = useCookie('csrf_token');
const form = reactive({ name: '', email: '', message: '' });

async function submit() {
  await $fetch('/api/contact', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrf.value },
    body: form
  });
}
</script>

<template>
  <form @submit.prevent="submit">
    <input v-model="form.name" placeholder="Name" />
    <input v-model="form.email" type="email" placeholder="Email" />
    <textarea v-model="form.message" placeholder="Message" />
    <button type="submit">Send</button>
  </form>
</template>
```

## Example: Settings Update

```ts
// server/api/settings.post.ts
import { defineVerifiedCsrfHandler, defineAuthenticatedEventHandler } from 'auth-h3client/v1';
import { defineEventHandler, readBody, assertMethod } from 'h3';
import { useStorage } from '#imports';

export default defineAuthenticatedEventHandler(
  defineVerifiedCsrfHandler(
    defineEventHandler(async (event) => {
      assertMethod(event, 'POST');
      
      const user = event.context.authorizedData!;
      const settings = await readBody(event);
      
      await db.settings.upsert({
        where: { userId: user.userId },
        update: settings,
        create: { userId: user.userId, ...settings }
      });
      
      return { success: true };
    })
  ),
  { storage: useStorage('cache') }
);
```

---

## See Also

- [defineAuthenticatedEventPostHandlers](./authenticatedPostHandler.md) - Auth + CSRF + POST combined
- [CSRF and Visitor](../csrf-and-visitor.md) - CSRF cookie generation
- [defineAuthenticatedEventHandler](./defineAuthenticatedEventHandler.md) - Authentication wrapper
