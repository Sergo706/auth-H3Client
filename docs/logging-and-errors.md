# Logging and Error Handling

This document covers the logging infrastructure and error handling patterns in auth-H3Client. The library uses **Pino** for structured logging and provides standardized error utilities for consistent error responses.

## Table of Contents

- [Overview](#overview)
- [HTTP Request Logger](#http-request-logger)
- [Application Logger](#application-logger)
- [Error Handling](#error-handling)
- [Telegram Alerts](#telegram-alerts)
- [Log Levels](#log-levels)
- [Production Recommendations](#production-recommendations)

---

## Overview

### Logging Pipeline

1.  **Request Ingestion**: Incoming request hits the server.
2.  **HTTP Logger**: Records request metadata (method, URL, IP, time).
3.  **Application Logger**: Records domain events inside handlers.
4.  **Output Stream**:
    -   **Standard**: JSON logs to `stdout`.
    -   **Security**: Critical events (bans, failed logins) are sent to **Telegram**.

| Component | Purpose |
|-----------|---------|
| HTTP Logger | Request/response logging with timing |
| Application Logger | Structured logging throughout handlers |
| Error Helper | Standardized error responses |
| Telegram Logger | Security alerts to Telegram |

---

## HTTP Request Logger

The HTTP logger plugin logs every request/response with structured metadata.

### Import

```typescript
// H3 v1
import { httpLogger } from 'auth-h3client/v1';

// H3 v2
import { httpLogger } from 'auth-h3client/v2';
```

### Usage

```typescript
// H3 v1 - Use as function (registers hooks)
const app = createApp();
httpLogger()(app);

// H3 v2 - Use as plugin
const app = createApp();
app.use(httpLogger);
```

### What Gets Logged

**Request log:**
```json
{
  "level": 30,
  "time": 1707400000000,
  "msg": "Incoming request",
  "reqId": "abc123",
  "method": "POST",
  "url": "/api/login",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

**Response log:**
```json
{
  "level": 30,
  "time": 1707400000100,
  "msg": "Request completed",
  "reqId": "abc123",
  "status": 200,
  "duration": 100
}
```

**Error log:**
```json
{
  "level": 50,
  "time": 1707400000100,
  "msg": "Request failed",
  "reqId": "abc123",
  "status": 401,
  "error": "AUTH_REQUIRED",
  "duration": 50
}
```

### Skipped Paths

The logger skips these paths to reduce noise:

| Pattern | Reason |
|---------|--------|
| `/_nuxt/*` | Static assets |
| `/favicon.ico` | Browser request |
| `/__nuxt_*` | Nuxt internals |
| `/manifest.json` | PWA manifest |
| `/*.js`, `/*.css` | Static files |
| `/health`, `/ready` | Health checks |

### Request ID Generation

Each request gets a unique ID (`reqId`) accessible via:

```typescript
export default defineEventHandler((event) => {
  const requestId = event.context.rid;
  // Use for correlation
});
```

---

## Application Logger

The application logger is a configured Pino instance with security-aware redaction rules.

### Import

```typescript
import { getLogger } from 'auth-h3client/v2';
```

### Usage

```typescript
const log = getLogger();

// Basic logging
log.info('User logged in');
log.warn('Rate limit approaching');
log.error('Authentication failed');

// Structured logging (recommended)
log.info({ userId: '123', action: 'login' }, 'User authenticated');

// Child loggers for context
const authLog = log.child({ service: 'auth', handler: 'login' });
authLog.info('Processing login');
```

### Configuration

The logger is configured based on the `logLevel` setting:

```typescript
configuration({
  logLevel: 'debug'  // 'debug' | 'info' | 'warn' | 'error' | 'fatal'
});
```

### Redaction Rules

Sensitive data is automatically redacted from logs:

| Field Pattern | Redacted |
|---------------|----------|
| `password` | `[REDACTED]` |
| `secret` | `[REDACTED]` |
| `token` | `[REDACTED]` |
| `authorization` | `[REDACTED]` |
| `cookie` | `[REDACTED]` |
| `*.password` | `[REDACTED]` |
| `*.secret` | `[REDACTED]` |

**Example:**
```typescript
// Input
log.info({ user: 'john', password: 'secret123' }, 'Login attempt');

// Output (password redacted)
{"user":"john","password":"[REDACTED]","msg":"Login attempt"}
```

### Pino Configuration

```typescript
// Internal configuration (from src/utils/logger.ts)
const logger = pino({
  level: config.logLevel ?? 'info',
  redact: {
    paths: [
      'password', 'secret', 'token', 'authorization', 'cookie',
      '*.password', '*.secret', '*.token', '*.authorization', '*.cookie'
    ],
    censor: '[REDACTED]'
  },
  formatters: {
    level: (label) => ({ level: label })
  }
});
```

---

## Error Handling

The `throwError` utility provides consistent error responses with logging.

### Import

```typescript
import { throwError } from 'auth-h3client/v2';
```

### Signature

```typescript
function throwError(
  log: pino.Logger,
  event: H3Event,
  appCode: ErrorCode,
  status: number,
  statusText: string,
  message?: string,
  cause?: string
): never
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `log` | `pino.Logger` | Logger instance for structured logging |
| `event` | `H3Event` | H3 event object |
| `appCode` | `ErrorCode` | Application-specific error code |
| `status` | `number` | HTTP status code |
| `statusText` | `string` | HTTP status text |
| `message` | `string?` | User-facing message |
| `cause` | `string?` | Internal cause for logging |

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTH_REQUIRED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_CREDENTIALS` | 400 | Bad credentials/input |
| `MISSING_BODY` | 400 | Request body missing |
| `INVALID_CONTENT_TYPE` | 415 | Wrong Content-Type |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |
| `AUTH_SERVER_ERROR` | 502 | Auth service unreachable |
| `TEMPERING` | 403 | Tampering detected |
| `HASH` | 400 | Invalid hash/signature |
| `REASON` | 400 | Invalid reason parameter |
| `UNEXPECTED_ERROR` | 500 | Unexpected error |

### Usage Examples

```typescript
import { throwError, getLogger } from 'auth-h3client/v2';

export default defineEventHandler((event) => {
  const log = getLogger().child({ handler: 'profile' });
  
  const userId = getRouterParam(event, 'id');
  if (!userId) {
    throwError(log, event, 'NOT_FOUND', 404, 'Not Found', 
               'User not found', `Missing userId param`);
  }
  
  const user = await db.users.findUnique({ where: { id: userId } });
  if (!user) {
    throwError(log, event, 'NOT_FOUND', 404, 'Not Found',
               'User not found', `User ${userId} not in database`);
  }
  
  return user;
});
```

### Error Response Format

When `throwError` is called, the response is:

```json
{
  "statusCode": 404,
  "statusMessage": "Not Found",
  "message": "User not found"
}
```

And the log entry:

```json
{
  "level": "error",
  "msg": "NOT_FOUND: User not found",
  "appCode": "NOT_FOUND",
  "status": 404,
  "cause": "User 123 not in database",
  "reqId": "abc123"
}
```

---

## Telegram Alerts

Security events can be sent to a Telegram chat for real-time monitoring.

### Configuration

```typescript
configuration({
  telegram: {
    enableTelegramLogger: true,
    token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    chatId: '-1001234567890',
    allowedUser: 'my_telegram_username'
  }
});
```

### What Gets Alerted

| Event | Priority |
|-------|----------|
| Successful login | Info |
| Failed login (multiple) | Warning |
| IP banned | High |
| Bot detected | High |
| MFA bypass attempt | Critical |
| Rate limit exceeded | Warning |

### Message Format

```
🔐 Auth Event

Type: LOGIN_SUCCESS
User: user@example.com
IP: 192.168.1.1
Time: 2024-02-08 15:30:00
RequestID: abc123
```

---

## Log Levels

| Level | Value | Use Case |
|-------|-------|----------|
| `fatal` | 60 | Application crash, unrecoverable errors |
| `error` | 50 | Failed operations, caught exceptions |
| `warn` | 40 | Potential issues, deprecations |
| `info` | 30 | Normal operations, significant events |
| `debug` | 20 | Detailed debugging information |
| `trace` | 10 | Very detailed tracing (rarely used) |

### Recommended Settings

| Environment | Level |
|-------------|-------|
| Development | `debug` |
| Staging | `debug` |
| Production | `info` or `warn` |

---

## Production Recommendations

### 1. Use Structured Logging

```typescript
// Good - structured
log.info({ userId, action: 'login', ip }, 'User authenticated');

// Bad - string interpolation
log.info(`User ${userId} logged in from ${ip}`);
```

### 2. Add Request Context

```typescript
const log = getLogger().child({ 
  reqId: event.context.rid,
  handler: 'profile'
});
```

### 3. Log Aggregation

Pipe Pino JSON output to a log aggregator:

```bash
# Development - pretty print
node server.js | npx pino-pretty

# Production - ship to aggregator
node server.js | npx pino-datadog-transport

# Or save to file
node server.js >> /var/log/myapp.log
```

### 4. Error Monitoring

Integrate with error tracking services:

```typescript
import * as Sentry from '@sentry/node';

// In error handler
log.error({ err, reqId }, 'Unhandled error');
Sentry.captureException(err);
```

### 5. Security Event Logging

Always log security-relevant events:

```typescript
log.warn({ 
  event: 'failed_login',
  email: email,  // Will NOT be redacted
  ip: clientIP,
  reason: 'invalid_password'
}, 'Login failed');
```

---

## See Also

- [Configuration](./configuration.md) - Log level and Telegram settings
- [CSRF & Visitor](./csrf-and-visitor.md) - Security middleware
- [defineAuthenticatedEventHandler](./wrappers/defineAuthenticatedEventHandler.md) - Auth wrapper with built-in error handling
