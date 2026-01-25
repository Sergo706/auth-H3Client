# Server to Service

`serviceToService` (exported alias of `sendToServer`) is an internal fetch wrapper designed for secure Server-to-Server communication between the Client (H3) and the Upstream Auth Service.

## Capabilities

1.  **HMAC Signing**: Automatically signs requests with a shared secret (if configured) to prove authenticity.
2.  **Header Forwarding**: Propagates `User-Agent`, `X-Forwarded-For`, and other context headers.
3.  **Cookie Forwarding**: Passes authentication cookies (`session`, `canary_id`).
4.  **Base URL**: Automatically prepends the configured Auth Service URL.

## Usage

```typescript
import { serviceToService } from 'auth-h3client/v1';

// Inside an event handler
export default defineEventHandler(async (event) => {
  
  const response = await serviceToService(
    true,              // 1. Expect JSON response? (if true, adds Accept: application/json)
    '/users/profile',  // 2. Path (relative to auth service root)
    'GET',             // 3. Method
    event,             // 4. H3 Event (for context/headers)
    undefined,         // 5. Body (optional)
    undefined          // 6. Extra Cookies (optional override)
  );

  return await response.json();
});
```

## Configuration

This utility relies on the Global Configuration set via `defineAuthConfiguration`:

- `server.auth_location`: Determines the destination host/port.
- `server.hmac`: Controls request signing.
