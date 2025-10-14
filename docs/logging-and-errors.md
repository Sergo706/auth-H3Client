# Logging and Errors

## HTTP logger plugin

- Source: `src/middleware/httpLogger.ts`
- Adds request IDs, structured request/response events, and error logs.
- Skips static assets and well-known paths.

Usage:

```ts
app.register(httpLogger());
```

## Application logger

- Source: `src/utils/logger.ts`
- `getLogger()` returns a configured pino instance with redact rules.

## Error helper

- Source: `src/middleware/error.ts`
- `throwError(log, event, appCode, status, statusText, message?, cause?)` logs and throws an `HTTPError`.
- App codes include: `AUTH_REQUIRED`, `SERVER_ERROR`, `AUTH_SERVER_ERROR`, `MISSING_BODY`, `INVALID_CONTENT_TYPE`, `FORBIDDEN`, `NOT_FOUND`, etc.

