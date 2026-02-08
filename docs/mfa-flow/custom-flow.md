# Custom MFA Flow

The custom MFA flow enables developers to require Multi-Factor Authentication for sensitive actions beyond login, such as password changes, email updates, account deletion, or financial transactions.

## Table of Contents

- [Overview](#overview)
- [Flow Diagram](#flow-diagram)
- [Implementation Guide](#implementation-guide)
- [Core Utilities](#core-utilities)
- [Complete Example](#complete-example)
- [Verification Methods](#verification-methods)
- [Error Handling](#error-handling)

## Overview

Unlike the built-in MFA flow (triggered automatically by the auth server), the custom MFA flow is **developer-initiated**. You decide which actions require additional verification and implement the flow using provided handler wrappers.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Reason** | A short identifier (max 100 chars) describing the action, e.g., `"password-change"` |
| **Random** | Cryptographic hash (254-500 chars) generated server-side for verification |
| **Magic Link** | Email link containing `visitor`, `temp`, `random`, and `reason` parameters |
| **Verification Code** | 7-digit numeric code included in the magic link |

### Two Verification Methods

1. **GET-based (Magic Link Click)** - User clicks link → handler wraps your code
2. **POST-based (Code Entry)** - User enters code manually → handler verifies before proceeding

## Flow Diagram

### Custom Flow Phases

#### Phase 1: Initiation
1.  **Request**: Client requests sensitive action (e.g., `POST /api/change-password`).
2.  **Generation**: API Handler generates a cryptographic hash (`random`) and stores it.
3.  **Trigger**: API Handler calls `askForMfaFlow`.
4.  **Email**: Auth Server sends verification email with code to user.
5.  **Response**: Handler responds `{ ok: true, message: "Check your email" }`. Client shows check-email UI.

#### Phase 2: Verification
The user verifies via **Link** or **Code**:

**A. Magic Link (GET)**
1.  User clicks email link.
2.  Request hits `defineVerifiedMagicLinkGetHandler` wrapper.
3.  Wrapper verifies token with Auth Server.
4.  If valid, wrapper executes your inner handler code.
5.  Handler performs action and returns success.

**B. Code Entry (POST)**
1.  User enters 7-digit code.
2.  Client POSTs to `defineMfaCodeVerifierHandler` wrapper.
3.  Wrapper verifies CSRF and validates code with Auth Server.
4.  **Token Rotation**: Auth Server issues new tokens.
5.  Wrapper rotates cookies and executes your inner handler code.
6.  Handler performs action and returns success.

## Implementation Guide

### Step 1: Create the Initiation Endpoint

First, create an endpoint that starts the MFA flow by sending a verification email:

```typescript
// server/api/change-password.post.ts
import { 
    defineAuthenticatedEventHandler,
    askForMfaFlow,
    getLogger
} from 'auth-h3client/v2';
import { randomBytes, createHash } from 'node:crypto';

export default defineAuthenticatedEventHandler(async (event) => {
    const log = getLogger().child({ service: 'api', action: 'change-password' });
    
    // Generate cryptographic random for this flow
    // Must be 254-500 characters
    const randomBuffer = randomBytes(256);
    const cryptoHash = createHash('sha512')
        .update(randomBuffer)
        .digest('hex')
        .repeat(2)
        .slice(0, 400);
    
    // Store the hash for later verification (in session, cache, or database)
    const storage = useStorage('cache');
    const userId = event.context.user.id;
    await storage.setItem(`mfa:password-change:${userId}`, cryptoHash, { ttl: 600 }); // 10 min TTL
    
    // Initiate MFA flow
    const result = await askForMfaFlow(event, log, 'password-change', cryptoHash);
    
    if (!result.ok) {
        throw createError({
            statusCode: 400,
            statusMessage: result.reason
        });
    }
    
    return {
        message: result.data,
        requiresVerification: true
    };
});
```

### Step 2: Create the GET Verification Endpoint (Magic Link)

Handle when users click the magic link:

```typescript
// server/api/change-password/verify.get.ts
import { defineVerifiedMagicLinkGetHandler, getLogger } from 'auth-h3client/v2';

export default defineVerifiedMagicLinkGetHandler(async (event) => {
    const log = getLogger().child({ service: 'api', action: 'change-password-verify' });
    
    // At this point, magic link has been verified by the auth server
    // event.context.link contains the verified action link
    // event.context.reason contains "password-change"
    
    const { link, reason } = event.context;
    log.info({ link, reason }, 'Magic link verified for password change');
    
    // Render the password change form or redirect
    // The link verification is complete - user is now verified for this action
    return {
        success: true,
        action: reason,
        message: 'Verification complete. You may now change your password.'
    };
});
```

### Step 3: Create the POST Verification Endpoint (Code Entry)

Handle when users submit the code manually:

```typescript
// server/api/change-password/verify.post.ts
import { 
    defineMfaCodeVerifierHandler,
    getLogger 
} from 'auth-h3client/v2';

export default defineMfaCodeVerifierHandler(async (event) => {
    const log = getLogger().child({ service: 'api', action: 'change-password-complete' });
    
    // At this point:
    // - CSRF has been verified
    // - MFA code has been verified with auth server
    // - Tokens have been rotated
    
    // Get the new password from request body (if applicable)
    const { newPassword } = event.context.body;
    
    if (!newPassword) {
        throw createError({
            statusCode: 400,
            statusMessage: 'New password is required'
        });
    }
    
    // Perform the sensitive action
    await performPasswordChange(event.context.user.id, newPassword);
    
    log.info('Password changed successfully after MFA verification');
    
    return {
        success: true,
        message: 'Password changed successfully'
    };
});
```

## Core Utilities

### `askForMfaFlow`

Initiates the custom MFA flow by requesting the auth server to send a verification email.

**Signature:**
```typescript
function askForMfaFlow(
    event: H3Event, 
    log: pino.Logger, 
    reason: string, 
    random: string
): Promise<UtilsResponse<string>>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `event` | `H3Event` | The H3 event object |
| `log` | `pino.Logger` | Logger instance for structured logging |
| `reason` | `string` | Action identifier (max 100 chars) |
| `random` | `string` | Cryptographic hash (254-500 chars) |

**Returns:**
```typescript
// Success
{ ok: true, date: string, data: "Please check your email to complete the action." }

// Failure
{ ok: false, date: string, reason: string, code: ErrorCode, retryAfter?: string }
```

**Error Codes:**

| Code | Condition |
|------|-----------|
| `INVALID_CREDENTIALS` | Missing `canary_id` or `session` cookies, or auth server rejected |
| `HASH` | Random hash length not between 254-500 |
| `REASON` | Reason string exceeds 100 characters |
| `FORBIDDEN` | User banned/blacklisted |
| `RATE_LIMIT` | Too many requests |
| `AUTH_SERVER_ERROR` | Auth server error |
| `AUTH_REJECTED` | Server rejected the flow request |
| `UNEXPECTED_ERROR` | Unhandled exception |

---

### `defineVerifiedMagicLinkGetHandler`

Higher-order function that wraps a GET handler with magic link verification.

**Signature:**
```typescript
function defineVerifiedMagicLinkGetHandler<T extends EventHandlerRequest, D>(
    handler: EventHandler<T, D>
): EventHandler<T, Promise<D>>
```

**Query Parameters (automatically validated):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `visitor` | `number` | Visitor/user identifier |
| `temp` | `string` | Temporary verification token |
| `random` | `string` | Cryptographic hash (254-500 chars) |
| `reason` | `string` | Action identifier (max 100 chars) |

**Validation Pipeline:**
1. Asserts method is GET
2. Validates CSRF token
3. Checks for `canary_id` and `session` cookies
4. Validates query parameters against `VerificationLinkSchema`
5. Verifies with auth server at `/auth/verify-custom-mfa/`

**Event Context Set:**
```typescript
event.context.link   // The verified action link
event.context.reason // The MFA flow reason identifier
```

---

### `defineMfaCodeVerifierHandler`

Higher-order function that wraps a POST handler with MFA code verification and token rotation.

**Signature:**
```typescript
function defineMfaCodeVerifierHandler<T extends EventHandlerRequest, D>(
    handler: EventHandler<T, D>
): EventHandler<T, Promise<D>>
```

**Validation Pipeline:**
1. Asserts method is POST
2. Validates CSRF token
3. Limits request body to 8MB
4. Checks for `canary_id` and `session` cookies
5. Validates query parameters against `VerificationLinkSchema`
6. Validates MFA code from `event.context.body.code` (7-digit numeric)
7. Verifies code with auth server
8. Applies token rotation on success

**Request Body (required):**
```json
{
  "code": "1234567",
  // ...other fields for your action
}
```

**Token Rotation:**
Upon successful verification, the handler automatically:
- Sets new `__Secure-a` access token cookie
- Sets new `a-iat` cookie
- Forwards `Set-Cookie` headers from auth server

## Complete Example

### Email Change Flow

Here's a complete example implementing email change with MFA verification:

```typescript
// server/api/settings/email.post.ts (Initiate)
import { defineAuthenticatedEventHandler, askForMfaFlow, getLogger } from 'auth-h3client/v2';
import { randomBytes, createHash } from 'node:crypto';

export default defineAuthenticatedEventHandler(async (event) => {
    const log = getLogger().child({ service: 'api', action: 'email-change' });
    const { newEmail } = await readBody(event);
    
    // Validate new email
    if (!isValidEmail(newEmail)) {
        throw createError({ statusCode: 400, message: 'Invalid email format' });
    }
    
    // Generate crypto hash
    const cryptoHash = generateCryptoHash();
    
    // Store pending change
    const storage = useStorage('cache');
    await storage.setItem(`mfa:email-change:${event.context.user.id}`, {
        newEmail,
        hash: cryptoHash,
        initiatedAt: Date.now()
    }, { ttl: 600 });
    
    // Initiate MFA
    const result = await askForMfaFlow(event, log, 'email-change', cryptoHash);
    
    if (!result.ok) {
        throw createError({ statusCode: 400, message: result.reason });
    }
    
    return { message: result.data };
});
```

```typescript
// server/api/settings/email/verify.post.ts (Complete)
import { defineMfaCodeVerifierHandler, getLogger } from 'auth-h3client/v2';

export default defineMfaCodeVerifierHandler(async (event) => {
    const log = getLogger().child({ service: 'api', action: 'email-change-complete' });
    
    // Retrieve pending change
    const storage = useStorage('cache');
    const pending = await storage.getItem(`mfa:email-change:${event.context.user.id}`);
    
    if (!pending) {
        throw createError({ statusCode: 400, message: 'No pending email change found' });
    }
    
    // Perform the email change
    await updateUserEmail(event.context.user.id, pending.newEmail);
    
    // Clean up
    await storage.removeItem(`mfa:email-change:${event.context.user.id}`);
    
    log.info({ newEmail: pending.newEmail }, 'Email changed successfully');
    
    return { 
        success: true, 
        message: 'Email updated successfully',
        newEmail: pending.newEmail 
    };
});
```

### Client-Side Integration

```vue
<script setup lang="ts">
import { ref } from 'vue';

const newEmail = ref('');
const verificationCode = ref('');
const step = ref<'input' | 'verify'>('input');
const verifyParams = ref<{ visitor: string; temp: string; random: string; reason: string } | null>(null);

async function initiateEmailChange() {
    const result = await $fetch('/api/settings/email', {
        method: 'POST',
        body: { newEmail: newEmail.value }
    });
    
    // Show verification step
    step.value = 'verify';
    // verifyParams would come from email link or be provided by the user
}

async function submitVerification() {
    if (!verifyParams.value) return;
    
    const { visitor, temp, random, reason } = verifyParams.value;
    
    await $fetch(`/api/settings/email/verify?visitor=${visitor}&temp=${temp}&random=${random}&reason=${reason}`, {
        method: 'POST',
        body: { 
            code: verificationCode.value 
        }
    });
    
    // Success
    step.value = 'input';
}
</script>
```

## Verification Methods

### Comparison

| Aspect | Magic Link (GET) | Code Entry (POST) |
|--------|------------------|-------------------|
| User Action | Click email link | Copy/paste 7-digit code |
| Token Rotation | No | Yes (automatic) |
| Security | Single-use link | Code validated + rotation |
| UX | One-click | Manual entry required |
| Best For | Simple verifications | Sensitive actions |

### When to Use Which

**Use `defineVerifiedMagicLinkGetHandler` when:**
- Action is informational (viewing sensitive data)
- Quick verification is preferred
- Token rotation is not necessary

**Use `defineMfaCodeVerifierHandler` when:**
- Action modifies data (password, email, settings)
- Maximum security is required
- Token rotation is desired for additional security

## Error Handling

### Error Response Format

All MFA utilities return structured errors:

```typescript
interface MfaError {
    ok: false;
    date: string;
    reason: string;
    code: 
        | 'INVALID_CREDENTIALS'
        | 'HASH'
        | 'REASON'
        | 'FORBIDDEN'
        | 'RATE_LIMIT'
        | 'AUTH_SERVER_ERROR'
        | 'AUTH_REJECTED'
        | 'UNEXPECTED_ERROR';
    retryAfter?: string;  // Present when rate limited
}
```

### Handling Rate Limits

```typescript
const result = await askForMfaFlow(event, log, reason, hash);

if (!result.ok && result.code === 'RATE_LIMIT') {
    throw createError({
        statusCode: 429,
        message: result.reason,
        headers: {
            'Retry-After': result.retryAfter ?? '60'
        }
    });
}
```

---

**Next:** [API Reference](./api-reference.md) - Complete API documentation for all MFA utilities.
