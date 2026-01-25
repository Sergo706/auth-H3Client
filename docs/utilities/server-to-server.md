# Server-to-Server Communication

Utilities for securely communicating with the upstream Auth Service from your Node.js/Nitro backend.

## `serviceToService`

The primary HTTP client wrapper. It handles:
1.  **Authentication**: Signs requests with HMAC (if enabled).
2.  **Context**: Forwards User-Agent and IPs.
3.  **Cookies**: Propagates `session` and `canary_id`.
4.  **Routing**: Resolves the upstream URL automatically.

**Signature:**
```typescript
async function serviceToService(
  expectJson: boolean,
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  event: H3Event,
  keepAlive: boolean, // Connection: keep-alive
  cookies?: { label: string; value: string }[],
  body?: any,
  token?: string      // Bearer token override
): Promise<Response | null>
```

**Usage:**
```typescript
import { serviceToService } from 'auth-h3client/v1';

// Call the auth service
const res = await serviceToService(
  true, 
  '/users/profile', 
  'GET', 
  event
);

const users = await res.json();
```

## `getAuthAgent`

Returns the `undici` Dispatcher (Agent) configured for the connection.
If you enabled **SSL (mTLS)** in your configuration, this agent contains the Client Certificate and Key.

**Usage:**
```typescript
import { getAuthAgent } from 'auth-h3client/v1';
import { fetch } from 'undici';

const agent = getAuthAgent();
await fetch('https://auth-service/point', { dispatcher: agent });
```

## `getBaseUrl`

Resolves the full URL (e.g., `https://auth.internal:4000`) based on the `server.auth_location` configuration.

**Usage:**
```typescript
import { getBaseUrl } from 'auth-h3client/v1';

console.log(getBaseUrl()); // 'http://localhost:4000'
```
