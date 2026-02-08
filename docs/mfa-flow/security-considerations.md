# MFA Security Considerations

This document outlines security best practices and considerations for implementing MFA in applications using auth-H3Client, aligned with industry standards from NIST, OWASP, and NCSC.

## Table of Contents

- [Security Architecture](#security-architecture)
- [Best Practices](#best-practices)
- [Threat Mitigation](#threat-mitigation)
- [Code Security Measures](#code-security-measures)
- [Email-Based MFA Security](#email-based-mfa-security)
- [Rate Limiting & Brute Force Protection](#rate-limiting--brute-force-protection)
- [Token Security](#token-security)
- [Recommendations](#recommendations)

---

## Security Architecture

### Defense in Depth

auth-H3Client's MFA implementation employs multiple security layers:

#### Layered Security Model
auth-H3Client employs four distinct security layers:

1.  **Network Layer**
    -   **IP Validation**: Filters malformed or banned IPs.
    -   **Bot Detection**: Blocks automated malicious traffic.
    -   **Rate Limiting**: Throttles abusive request patterns.

2.  **Session Layer**
    -   **CSRF Protection**: Prevents cross-site forgery.
    -   **Secure Cookies**: `HttpOnly`, `Secure`, `SameSite=Strict`.
    -   **Canary Tracking**: Binds session to anti-fraud ID.

3.  **Verification Layer**
    -   **Ephemeral Tokens**: Short-lived `temp` tokens limit attack window.
    -   **Cryptographic Random**: High-entropy hashes verify requests.
    -   **Code Validation**: 7-digit strict numeric validation.

4.  **Token Layer**
    -   **Token Rotation**: Issues new session tokens on success.
    -   **Session Binding**: Validates MFA against existing session.

### Security Properties

| Property | Implementation | Purpose |
|----------|---------------|---------|
| **Session Binding** | `canary_id` cookie | Ties MFA to existing session |
| **Replay Protection** | `safeAction()` deduplication | Prevents replay attacks |
| **CSRF Protection** | `X-CSRF-Token` header | Prevents cross-site request forgery |
| **Ephemeral Tokens** | Short-lived `temp` parameter | Limits attack window |
| **Cryptographic Verification** | 254-500 char `random` hash | Server-side request verification |
| **Token Rotation** | New tokens on MFA success | Invalidates pre-MFA session |

---

## Best Practices

### 1. Use Strong Cryptographic Random

Generate sufficiently random and long hashes for the `random` parameter:

```typescript
import { randomBytes, createHash } from 'node:crypto';

function generateCryptoHash(): string {
    // Generate 256 bytes of random data
    const randomBuffer = randomBytes(256);
    
    // Create SHA-512 hash and extend to 400 characters
    return createHash('sha512')
        .update(randomBuffer)
        .digest('hex')
        .repeat(2)
        .slice(0, 400);
}
```

> [!IMPORTANT]
> The `random` parameter **must** be between 254-500 characters. The library validates this and rejects shorter hashes.

### 2. Store and Validate Random Server-Side

Always store the generated `random` hash server-side and validate it when processing the verification:

```typescript
// When initiating MFA
const hash = generateCryptoHash();
await storage.setItem(`mfa:${action}:${userId}`, {
    hash,
    initiatedAt: Date.now()
}, { ttl: 600 }); // 10 minutes

// When processing verification
const stored = await storage.getItem(`mfa:${action}:${userId}`);
if (!stored || stored.hash !== providedRandom) {
    throw createError({ statusCode: 400, message: 'Invalid verification' });
}
```

### 3. Implement Short Token TTLs

Configure short time-to-live values for MFA tokens:

| Token Type | Recommended TTL | Maximum |
|------------|-----------------|---------|
| Temp verification token | 5-10 minutes | 15 minutes |
| Cached MFA state | 10 minutes | 30 minutes |
| Rate limit entries | 10-60 seconds | - |

### 4. Use HTTPS Only

All MFA operations must occur over HTTPS:

```typescript
// Cookies are set with secure flags
makeCookie(event, '__Secure-a', accessToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,  // HTTPS only
    path: '/',
    domain: domain,
    maxAge: accessTokenTTL
});
```

### 5. Validate All Inputs

Use Zod schemas for strict input validation:

```typescript
// Verification link schema enforces constraints
const verificationLink = z.object({
    random: makeSafeString({ min: 254, max: 500 }),
    reason: makeSafeString({ min: 0, max: 100 }),
    visitor: z.coerce.number(),
    temp: z.string()
});

// Code schema enforces 7-digit format
const code = z.strictObject({ 
    code: makeSafeString({
        min: 7,
        max: 7,
        pattern: /^\d{7}$/
    })
});
```

---

## Threat Mitigation

### Session Hijacking

**Threat:** Attacker intercepts session and attempts MFA bypass.

**Mitigations:**
- `canary_id` cookie binds session to anti-fraud tracking
- Token rotation after successful MFA invalidates previous tokens
- Secure, httpOnly, sameSite cookies prevent interception

### Brute Force Attacks

**Threat:** Attacker attempts to guess MFA codes.

**Mitigations:**
- 7-digit codes provide 10 million combinations
- Rate limiting on auth server (429 responses)
- `Retry-After` header enforcement
- Request deduplication via `safeAction()`

### Replay Attacks

**Threat:** Attacker captures and replays verification requests.

**Mitigations:**
- One-time use `temp` tokens
- `safeAction()` prevents concurrent duplicate requests
- Token rotation invalidates old tokens

### CSRF Attacks

**Threat:** Attacker tricks user into performing MFA action.

**Mitigations:**
- `X-CSRF-Token` header required on all POST requests
- CSRF token tied to session via signed cookie
- `defineVerifiedCsrfHandler` wrapper enforces validation

### Phishing

**Threat:** User tricked into entering code on fake site.

**Mitigations:**
- Magic links contain signed tokens validated server-side
- Domain binding in cookie settings
- Secure cookie prefixes (`__Secure-`, `__Host-`)

> [!WARNING]
> Email-based MFA is only as secure as the user's email account. Consider recommending authenticator apps for high-security scenarios.

---

## Code Security Measures

### 7-Digit Code Format

The library enforces a strict 7-digit numeric format:

```typescript
const code = z.strictObject({ 
    code: makeSafeString({
        min: 7,
        max: 7,
        pattern: /^\d{7}$/,
        patternMsg: 'Invalid or expired code'
    })
});
```

**Security Analysis:**

| Metric | Value |
|--------|-------|
| Total combinations | 10,000,000 |
| Brute force at 1 req/sec | ~115 days |
| With rate limiting (10 min lockout) | Infeasible |

### Code Validation Flow

#### Validation Logic Flow
1.  **User Input**: User submits code.
2.  **Zod Validation**:
    -   **Strict Pattern**: Must match `/^\d{7}$/`.
    -   **Failure**: Returns `400 Bad Request` immediately.
3.  **Upstream Verification**:
    -   **Auth Server**: Checks code against database/cache.
    -   **Failure**: Returns `400` + logs attempt.
    -   **Success**: Triggers Token Rotation.
4.  **Completion**: Returns success response to client.

---

## Email-Based MFA Security

### Inherent Limitations

Email-based MFA relies on the security of the user's email account. According to NIST guidelines:

> [!CAUTION]
> NIST SP 800-63B discourages SMS as an out-of-band authenticator due to SIM swapping vulnerabilities. While email is slightly more secure, it's still subject to account compromise.

### Magic Link Security

auth-H3Client implements several protections for magic links:

| Protection | Implementation |
|------------|---------------|
| Unique tokens | Server-generated cryptographic tokens |
| Short expiration | Configurable TTL (default 5-10 min) |
| Single use | Tokens invalidated after verification |
| Session binding | `canary_id` prevents cross-session use |
| Login notification | Logging of successful verifications |

### Recommendations for Email MFA

1. **Augment with additional factors** when possible
2. **Monitor for suspicious login attempts**
3. **Implement email authentication** (SPF, DKIM, DMARC)
4. **Educate users** about email security

---

## Rate Limiting & Brute Force Protection

### Rate Limit Implementation

The auth server returns 429 with `Retry-After` header:

```typescript
if (res.status === 429) {
    log.warn(`User rate limited`);  
    const retrySec = res.headers.get('Retry-After');
    return {
        ok: false,
        date: new Date().toISOString(),
        reason: `Too many attempts, please try again later.`,
        code: "RATE_LIMIT",
        retryAfter: retrySec
    };
}
```

### Client Handling

```typescript
const result = await askForMfaFlow(event, log, reason, hash);

if (!result.ok && result.code === 'RATE_LIMIT') {
    appendHeader(event, 'Retry-After', result.retryAfter ?? '60');
    event.res.status = 429;
    return { 
        error: 'Too many attempts', 
        retryAfter: result.retryAfter 
    };
}
```

### Recommended Limits

| Action | Limit | Window |
|--------|-------|--------|
| MFA initiation | 3 attempts | 15 minutes |
| Code submission | 5 attempts | 10 minutes |
| Failed codes | Lock after 5 | 30 minutes |

---

## Token Security

### Token Rotation After MFA

Successful MFA verification triggers automatic token rotation:

```typescript
const mfaResults: RotationResult = {
    type: 'both',
    newToken: accessToken,
    newRefresh: sessionValue,
    accessIat: accessIat,
    rawSetCookie: setCookies,
};

applyRotationResult(event, mfaResults, domain, accessTokenTTL);
```

### Cookie Security Flags

All authentication cookies use maximum security flags:

```typescript
{
    httpOnly: true,      // No JavaScript access
    sameSite: 'strict',  // No cross-site requests
    secure: true,        // HTTPS only
    path: '/',
    domain: domain,
    maxAge: accessTokenTTL
}
```

### Cookie Prefixes

The library uses secure cookie prefixes:

- `__Secure-a` - Access token (requires `secure` flag)
- Standard cookies use `httpOnly` and `sameSite` flags

---

## Recommendations

### For High-Security Applications

1. **Consider additional factors**
   - Implement TOTP (authenticator apps) as an alternative
   - Support hardware security keys (FIDO2/WebAuthn)
   - Biometric verification where supported

2. **Implement context-aware authentication**
   - Risk scoring based on device, location, behavior
   - Step-up authentication for sensitive actions
   - Anomaly detection for unusual patterns

3. **Enhanced monitoring**
   - Log all MFA attempts (success and failure)
   - Alert on unusual patterns
   - Implement real-time security dashboards

### For Standard Applications

1. **Follow the library defaults**
   - CSRF protection enabled
   - Token rotation on MFA success
   - Request deduplication active

2. **Configure appropriate TTLs**
   - Balance security with user experience
   - Shorter TTLs for sensitive actions

3. **Educate users**
   - Clear instructions for MFA process
   - Security awareness about email phishing

### NIST SP 800-63B Compliance

| Requirement | auth-H3Client Implementation |
|-------------|------------------------------|
| Multi-factor authentication | ✅ Email + session cookies |
| Replay resistance | ✅ One-time tokens, deduplication |
| Strong cryptography | ✅ SHA-512, secure random |
| Secure token storage | ✅ httpOnly cookies |
| Session binding | ✅ canary_id tracking |

> [!TIP]
> For AAL2 (Authenticator Assurance Level 2) compliance, consider augmenting email-based MFA with authenticator apps or hardware tokens.

---

## Security Checklist

Before deploying MFA, verify:

- [ ] HTTPS enabled for all endpoints
- [ ] CSRF protection configured and tested
- [ ] Rate limiting configured on auth server
- [ ] Token TTLs appropriately short
- [ ] Logging enabled for MFA events
- [ ] Error messages don't leak sensitive info
- [ ] Cookie security flags verified
- [ ] Input validation tested with edge cases
- [ ] Token rotation confirmed on successful MFA
- [ ] Email deliverability (SPF/DKIM/DMARC) configured

---

## Further Reading

- [NIST SP 800-63B: Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [OWASP Multi-Factor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [NCSC Multi-Factor Authentication Guidance](https://www.ncsc.gov.uk/guidance/multi-factor-authentication-online-services)
