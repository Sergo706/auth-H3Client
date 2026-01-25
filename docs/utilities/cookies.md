# Cookies and Cryptography

Utilities for managing HTTP cookies with secure defaults and cryptographic signing.

## `makeCookie`

Sets a cookie on the H3 response object.

**Signature:**
```typescript
function makeCookie(
  event: H3Event, 
  name: string, 
  value: string, 
  serializeOptions?: SerializeOptions
): void
```

**Defaults:**
If no options are provided, it defaults to:
-   `httpOnly: true` (Security against XSS)
-   `secure: true` (HTTPS only)
-   `sameSite: 'strict'` (CSRF protection)
-   `path: '/'`

**Usage:**
```typescript
import { makeCookie } from 'auth-h3client/v1';

makeCookie(event, 'theme', 'dark', { maxAge: 60 * 60 * 24 });
```

## `createSignedValue`

Creates a tamper-proof string by appending a signature. Use this for storing trusted data on the client (like a State cookie).

**Signature:**
```typescript
function createSignedValue(
  value: string, 
  maxAge: number,         // Affects simple signature if needed
  mode: 'strict' | 'normal'
): string
```

**Algorithm:**
Uses `crypto.createHmac('sha1', secret)` where `secret` is your `cryptoCookiesSecret` from configuration.
Format: `value.signature`

**Usage:**
```typescript
const signedState = createSignedValue('random-state-123', 3600, 'normal');
```

## `verifySignedValue`

Verifies a signed string was created by this server and hasn't been tampered with.

**Signature:**
```typescript
function verifySignedValue(
  signedValue: string, 
  mode: 'strict' | 'normal'
): { valid: boolean; value?: string }
```

**Usage:**
```typescript
const { valid, value } = verifySignedValue(incomingCookie, 'normal');

if (!valid) {
  throw new Error('Cookie tempering detected!');
}
```

## `toB64` / `fromB64`

URL-Safe Base64 encoding/decoding equivalents.
Used internally for OAuth state encoding.

```typescript
import { toB64, fromB64 } from 'auth-h3client/v1';

const encoded = toB64('hello world');
const decoded = fromB64(encoded);
```
