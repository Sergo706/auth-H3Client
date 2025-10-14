# Server-to-Server Requests

This library wraps fetch to the auth service so you always send the right headers, cookies, and optional HMAC signature.

- Source: `src/utils/serverToServer.ts`
- Export: `sendToServer` (re-exported as `serviceToService` from `src/main.ts`)

## Overview

`sendToServer` attaches:
- Forwarded client headers (IP, UA, referer, original path)
- Optional cookies (refresh/session, canary, etc.)
- Optional `Authorization: Bearer <token>` header
- Optional HMAC headers when enabled via config

It also selects an `undici` Agent via `getAuthAgent`, and times out requests with `AbortSignal.timeout(3000)`.

## Signature

```ts
async function sendToServer<T>(
  keepAlive: boolean,
  endpoint: string,
  method: string,
  event: H3Event,
  body: boolean,
  cookies?: {label: string; value: any} | Array<{label: string; value: any}>,
  data?: object,
  token?: string,
): Promise<Response | void>
```

## Headers and Cookies

- HMAC (optional): `X-Client-Id`, `X-Timestamp`, `X-Request-Id`, `X-Signature`
- Forwarded: `User-Agent`, `X-Forwarded-For`, `X-Real-IP`, `Origin`, `Host`, `X-Original-Path`, `X-Forwarded-Host`, `X-Forwarded-Proto`, etc.
- Cookies: Built from the provided list and sent as a single `Cookie` header.

## Example

```ts
import { serviceToService } from 'auth-h3client';

const res = await serviceToService(
  false,
  '/auth/login',
  'POST',
  event,
  true,
  [{ label: 'canary_id', value: getCookie(event, 'canary_id') }],
  { email, password }
);

if (!res || !res.ok) {
  // handle upstream error
}
const data = await res.json();
```

## Error handling

- Upstream failures are logged; the `Response` is returned so callers can branch by status code.
- Network faults return `void`. Treat this as a connection-level failure.

