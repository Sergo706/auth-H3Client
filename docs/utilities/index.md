# H3 & Server Utilities

The library exports over 30 utilities and helpers from its shared core. These are available in both `auth-h3client/v1` and `auth-h3client/v2`.

## Security Middleware

- [**Bot Detector**](./botDetectorMiddleware.md): Blocks automated traffic and bans IPs. (Requires Auth Service configuration)
- [**Request Deduplication**](../wrappers/defineDeduplicatedEventHandler.md): Prevents race conditions for critical actions.
- **HMAC Signature**: Verifies request integrity from downstream services.

## Caching & State

- [**MiniCache**](./MiniCache.md): A lightweight in-memory TTL cache.
- **lockAsyncAction**: A Promise-based locking mechanism for deduplication.

## Helpers

- [**Cookie & Token Helpers**](./helpers.md): `makeCookie`, `createSignedValue`, etc.
- [**Server-to-Server**](./serverToService.md): Secured fetch wrapper for backend communication.
