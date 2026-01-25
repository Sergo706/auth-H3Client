# Logging and Alerts

The library uses `pino` for high-performance structured logging and includes a built-in Telegram notifier for security alerts.

## `getLogger`

Returns the global, configured Pino logger instance. You should use this instead of `console.log` for consistent formatting and JSON output.

**Usage:**
```typescript
import { getLogger } from 'auth-h3client/v1';

const log = getLogger();
log.info({ userId: 123 }, 'User logged in');
```

## `httpLogger`

An H3 middleware that logs every incoming HTTP request (method, url, duration, status).

**Usage:**
```typescript
// Pure H3
import { httpLogger } from 'auth-h3client/v1';
app.use(httpLogger());
```

**Auto-Wiring:**
In Nuxt, this is applied automatically if `enableMiddleware: true` (which is default).

## `sendTelegramMessage`

Sends a message to a Telegram Channel via a bot. Useful for critical alerts (e.g., "Admin Login", "Brute Force Detected").

**Configuration:**
Requires `telegram.enableTelegramLogger: true` in `defineAuthConfiguration`.

**Signature:**
```typescript
async function sendTelegramMessage(
  message: string, 
  level: 'info' | 'warn' | 'error'
): Promise<void>
```

**Usage:**
```typescript
import { sendTelegramMessage } from 'auth-h3client/v1';

await sendTelegramMessage(' Database connection lost!', 'error');
```
