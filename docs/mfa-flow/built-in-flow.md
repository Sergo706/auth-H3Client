# Built-in MFA Flow

The built-in MFA flow handles Multi-Factor Authentication during standard login and signup processes. This flow is triggered automatically by the auth server when additional verification is required.

## Table of Contents

- [Overview](#overview)
- [Flow Diagram](#flow-diagram)
- [Trigger Conditions](#trigger-conditions)
- [Implementation Details](#implementation-details)
- [Route Handlers](#route-handlers)
- [Client Integration](#client-integration)
- [Error Handling](#error-handling)

## Overview

The built-in MFA flow consists of three main phases:

1. **Detection** - The auth server responds with HTTP 202 indicating MFA is required
2. **Verification Link** - User receives email with magic link containing verification parameters
3. **Code Submission** - User submits the 7-digit code or clicks the magic link

### Flow Characteristics

| Aspect | Details |
|--------|---------|
| Trigger | Automatic, based on server policy |
| Email Type | Magic link with embedded verification code |
| Code Format | 7-digit numeric string |
| Token TTL | Short-lived (configurable on auth server) |
| Session Binding | Tied to `canary_id` cookie |

## Flow Diagram

### Step-by-Step Flow

#### Phase 1: Login Triggers MFA
1.  **User Login**: User submits credentials via the Client App.
2.  **Proxy Request**: Client app requests login via `auth-H3Client`.
3.  **Validation**: Auth Server validates credentials. If MFA is required:
    -   Sends an email with a 7-digit code and magic link.
    -   Returns **HTTP 202** with `{ mfaRequired: true }`.
4.  **Client Response**: Gateway forwards the 202 response; Client App displays the MFA input UI.

#### Phase 2: User Verification
The user can complete verification via **Magic Link** or **Code Entry**:

**A. Magic Link Click**
1.  User clicks the link in email.
2.  Gateway (`verifyTempLink`) validates the token with Auth Server.
3.  Gateway returns metadata `{ action: 'verify-mfa' }`.
4.  Client automatically proceeds to specific code submission or lets user verify.

**B. Code Submission**
1.  User enters the **7-digit code**.
2.  Client POSTs code to `/auth/verify-mfa/:visitor`.
3.  **Gateway Checks**: Verifies CSRF and session cookies.
4.  **Upstream Verification**: Auth Server confirms code validity.
5.  **Success**: Tokens are rotated. New cookies are set. User is redirected.

## Trigger Conditions

MFA is triggered when the auth server determines additional verification is needed. Common triggers include:

| Condition | Description |
|-----------|-------------|
| First login on new device | Unrecognized device fingerprint |
| Suspicious location | Login from unusual geographic location |
| Elevated risk score | Behavioral anomaly detection |
| Policy requirement | Mandatory MFA for all logins |
| Sensitive account | High-privilege user accounts |

### Detecting MFA Requirement

The client library detects MFA requirements through HTTP 202 responses:

```typescript
// In getCachedUserData
if (res.status === 202) {
    log.warn(json.message ?? json.error ?? 'MFA required');  
    return {
        type: 'ERROR',
        status: 202,
        reason: 'MFA',
        msg: json.message ?? json.error ?? 'MFA required'
    };
}

// In ensureAccessToken middleware
if (res.status === 202) {
    setResponseStatus(event, 202, 'OK')
    return {
        text: 'MFA required',
        message: json.message
    }
}
```

## Implementation Details

### File Structure

```
packages/client-h3v2/src/
├── controllers/
│   ├── sendMfaCode.ts      # POST handler for code submission
│   └── verifyTempLink.ts   # GET handler for link verification
├── routes/
│   └── magicLinks.ts       # Route registration
```

### Route Registration

The `magicLinksRouter` registers all MFA routes with proper middleware:

```typescript
// packages/client-h3v2/src/routes/magicLinks.ts
export function magicLinksRouter(router: H3, prefix?: string) {
    const p = (path: string) => prefix ? `/${prefix}${path}` : path;

    router
        .get(p("/auth/verify-mfa/:visitor"), verifyLink,
            {middleware: [noStore, csrfToken]}
        )
        .post(p('/auth/verify-mfa/:visitor'), sendCode, 
            {middleware: [verifyLink, checkCsrf, contentType('application/json'), limitBytes(1024)]}
        );
}
```

## Route Handlers

### GET `/auth/verify-mfa/:visitor` - Link Verification

Validates the magic link and returns metadata about the verification action.

**Handler:** `verifyTempLink`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `temp` | string | Yes | Temporary verification token |

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `visitor` | string | User/visitor identifier |

**Response (200 OK):**
```json
{
  "action": "verify-mfa",
  "linkType": "MFA Code"
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 302 | Missing `canary_id` cookie or `temp` parameter → redirect to `/auth` |
| 404 | Invalid action pattern in URL |
| 500 | Auth server communication error |

**Implementation:**
```typescript
// verifyTempLink.ts
export default defineHandler(async (event) => {
    const { temp } = getQuery(event)
    const visitor = getRouterParam(event, "visitor");
    
    const cookies = {
        label: 'canary_id',
        value: getCookie(event, 'canary_id')
    }
    
    // Validate prerequisites
    if (!cookies.value || typeof temp !== "string" || !temp) {
        log.warn('Invalid temp link token. Or canary is possibly undefined')
        return redirect('/auth');
    }
    
    // Extract action from URL pattern
    const url = getRequestURL(event).pathname;
    const getAction = /\/auth\/([^/]+)\//;
    const action = url.match(getAction)?.[1];
    if (!action) return notFoundHandler(event);
    
    // Verify with auth server
    const serverResponse = await sendToServer(
        false, 
        `/auth/${action}/${visitor}?temp=${encodeURIComponent(temp)}`,
        'GET', 
        event, 
        false, 
        cookies
    );
    
    if (serverResponse.ok && event.req.method === 'GET') { 
        return { action, linkType };
    }
    
    return notFoundHandler(event);
});
```

### POST `/auth/verify-mfa/:visitor` - Code Submission

Verifies the MFA code and completes authentication with token rotation.

**Handler:** `sendMfaCode`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `temp` | string | Yes | Temporary verification token |

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `visitor` | string | User/visitor identifier |

**Request Body:**
```json
{
  "code": "1234567"
}
```

**Headers Required:**
- `Content-Type: application/json`
- `X-CSRF-Token: <csrf_token>`

**Success Response (200 OK / 303 Redirect):**

For JSON requests (`Accept: application/json`):
```json
{
  "ok": true,
  "redirectTo": "/dashboard"
}
```

For HTML requests: HTTP 303 redirect to `onSuccessRedirect` URL.

**Cookies Set on Success:**
| Cookie | Value | Options |
|--------|-------|---------|
| `__Secure-a` | New access token | httpOnly, secure, sameSite=strict, domain, maxAge |
| `a-iat` | Access token IAT | httpOnly, secure, sameSite=strict, domain, maxAge |
| Server cookies | Via `Set-Cookie` headers | Forwarded from auth server |

**Error Responses:**
| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing request body | `{ error: 'Invalid request body' }` |
| 400 | Missing code | `{ error: 'Invalid code attempt' }` |
| 400 | Invalid/expired code | `{ error: 'Invalid or expired code' }` |
| 401 | Bad MFA code | `{ error: 'Invalid or expired code' }` |
| 403 | Missing cookies/temp | Error thrown |
| 500 | Server error | Error thrown |

**Implementation:**
```typescript
// sendMfaCode.ts
export default defineDeduplicatedEventHandler(async (event) => {
    const { domain, accessTokenTTL } = await getOperationalConfig(event);
    const { onSuccessRedirect } = getConfiguration();
    
    assertMethod(event, "POST");
    const { temp } = getQuery(event);
    const visitor = getRouterParam(event, "visitor");
    
    // Validate cookies
    const cookies = {
        label: 'canary_id',
        value: getCookie(event, 'canary_id')
    }
    
    if (!cookies.value || typeof temp !== "string" || !temp) {
        throwError(log, event, 'INVALID_CREDENTIALS', 403, 'FORBIDDEN', ...);
    }
    
    // Validate body
    const body = event.context.body as { code: string | undefined };
    if (!body) {
        throwError(log, event, 'MISSING_BODY', 400, ...);
    }
    
    const { code } = body;
    if (!code) {
        throwError(log, event, 'INVALID_CREDENTIALS', 400, ...);
    }
    
    // Call auth server
    const serverResponse = await sendToServer(
        false,
        `/auth/verify-mfa/${visitor}?temp=${encodeURIComponent(temp)}`,
        'POST',
        event,
        true,  // Include body
        cookies,
        { code }
    );
    
    if (!serverResponse.ok) {
        event.res.status = 401;
        return { error: 'Invalid or expired code' };
    }
    
    // Apply token rotation
    const setCookies = serverResponse.headers.getSetCookie();
    const json = await serverResponse.json();
    const accessToken = json.accessToken;
    const accessIat = json.accessIat;
    
    if (setCookies && accessToken) {
        setCookies.forEach(line => event.res.headers.append('Set-Cookie', line));
        
        makeCookie(event, '__Secure-a', accessToken, {
            httpOnly: true,
            sameSite: 'strict',
            secure: true,
            path: '/',
            domain: domain,
            maxAge: accessTokenTTL
        });
        
        makeCookie(event, 'a-iat', accessIat, {
            httpOnly: true,
            sameSite: 'strict',
            secure: true,
            path: '/',
            domain: domain,
            maxAge: accessTokenTTL
        });
        
        // Return based on Accept header
        const wantsJSON = event.req.headers.get('accept')?.includes('application/json');
        if (wantsJSON) { 
            event.res.status = 200; 
            return { ok: true, redirectTo: onSuccessRedirect };
        }
        return redirect(onSuccessRedirect, 303);
    }
    
    event.res.status = 400;
    return { error: 'Invalid or expired code' };
});
```

## Client Integration

### Nuxt/Vue Integration

The client library provides composables for handling MFA on the frontend:

```vue
<script setup lang="ts">
// useAuthData auto-imported by Nuxt module
const auth = await useAuthData();

// Check if MFA is required
if (auth.value.mfaRequired) {
    console.log('MFA required:', auth.value.message);
    // Redirect to MFA page or show MFA UI
    navigateTo('/auth/mfa');
}
</script>
```

### MFA Page Example

```vue
<!-- pages/auth/mfa.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { executeRequest, getCsrfToken } from '#imports';

const code = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

// Get visitor and temp from URL query
const route = useRoute();
const { visitor, temp } = route.query;

async function submitCode() {
    loading.value = true;
    error.value = null;
    
    try {
        const result = await executeRequest<{ ok: boolean; redirectTo: string }>(
            `/api/auth/verify-mfa/${visitor}?temp=${temp}`,
            'POST',
            { code: code.value }
        );
        
        if (result.ok && result.data.ok) {
            navigateTo(result.data.redirectTo);
        }
    } catch (e) {
        error.value = 'Invalid or expired code. Please try again.';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="mfa-container">
        <h2>Enter Verification Code</h2>
        <p>We've sent a 7-digit code to your email.</p>
        
        <input 
            v-model="code" 
            type="text" 
            maxlength="7"
            pattern="\d{7}"
            placeholder="1234567"
        />
        
        <p v-if="error" class="error">{{ error }}</p>
        
        <button @click="submitCode" :disabled="loading || code.length !== 7">
            {{ loading ? 'Verifying...' : 'Verify Code' }}
        </button>
    </div>
</template>
```

## Error Handling

### Common Error Scenarios

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Expired code | 401 response | Prompt user to request new code |
| Invalid code format | Client-side validation | Show format requirements |
| Missing session | 403 / redirect to `/auth` | Full re-authentication required |
| Rate limited | 429 + `Retry-After` header | Show countdown timer |
| Server error | 500 response | Show generic error, allow retry |

### Logging

All MFA operations are logged with structured metadata:

```typescript
const log = getLogger().child({
    service: 'auth',
    branch: 'mfa',
    reqID: event.context.rid,
    temp: temp,
    visitor: visitor,
    canary_id: getCookie(event, 'canary_id')
});
```

---

**Next:** [Custom MFA Flow](./custom-flow.md) - Learn how to implement MFA for sensitive actions.
