# Bot Detector

`botDetectorMiddleware` is a security middleware that analyzes incoming traffic patterns and signatures. It works by communicating with the upstream **Auth Service**.

## How it works

1.  **Check**: On every request (that isn't a static asset), the middleware sends a request to the Auth Service's `/check` endpoint.
2.  **Analyze**: The Auth Service analyzes the IP, headers, and past behavior.
3.  **Action**:
    - If safe: The request proceeds.
    - If suspicious: The user is challenged or tracked.
    - If malicious: The request is blocked (403).

## Configuration Dependency

> [!WARNING]
> This middleware requires the **Upstream Auth Service** to be configured for banning.

The `enableFireWallBans` setting mentioned in some contexts is **not** a client setting. It is a configuration on the **Auth Service** side.

- If the Auth Service runs with `sudo` privileges and `ufw` enabled, it can ban malicious IPs at the firewall level.
- If the Auth Service is serverless, it returns 403 but cannot modify the firewall.

## Usage

In plain H3:

```typescript
import { botDetectorMiddleware } from 'auth-h3client/v1';

app.use(botDetectorMiddleware);
```

In Nuxt (enabled by default):

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['auth-h3client/module'],
  authH3Client: {
    enableMiddleware: true // Includes bot detector
  }
})
```
