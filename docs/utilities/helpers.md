# General Helpers

Low-level utilities for object manipulation and response parsing.

## `safeObjectMerge`

Deeply merges two objects. It contains specific protections against **Prototype Pollution** attacks (e.g., ignoring `__proto__`, `constructor`, `prototype` keys).

**Usage:**
```typescript
const merged = safeObjectMerge(defaultConfig, userConfig);
```

## `findStringsInObject`

Recursively scans an object for specific string values. Used internally for cleaning or validation.

**Usage:**
```typescript
const secretsFound = findStringsInObject(config, ['password', 'secret']);
```

## `parseResponseContentType`

A helper to safely parse `fetch` responses based on the `Content-Type` header.
-   `application/json` -> `res.json()`
-   `text/*` -> `res.text()`
-   Other -> `res.blob()` (or null)

**Usage:**
```typescript
const data = await parseResponseContentType(logger, response);
```
