import pino from "pino";
import { Results, safeAction, type UtilsResponse } from "@internal/shared";
import { getCookie, H3Event } from "h3";
import { sendToServer } from "./serverToServer.js";

/**
 * Initiates a custom MFA verification flow by requesting the auth server to send
 * a verification email to the user.
 *
 * This function validates the user's session cookies, constructs the MFA request,
 * and communicates with the authentication server. Upon success, the server sends
 * a verification email containing either a magic link or a code.
 *
 * @param event - The H3 event object containing the request context and cookies
 * @param log - Pino logger instance for structured logging
 * @param reason - A short identifier for the MFA flow purpose (max 100 chars)
 *                 Examples: "password-reset", "email-change", "sensitive-action"
 * @param random - A cryptographic hash/token for request verification (254-500 chars)
 *                 This should be generated server-side and stored for later validation
 *
 * @returns A promise resolving to a {@link UtilsResponse} containing:
 *   - On success: `{ ok: true, data: "Please check your email..." }`
 *   - On failure: `{ ok: false, reason: string, code: ErrorCode }`
 *
 * @example
 * ```typescript
 * const result = await askForMfaFlow(event, log, "password-reset", cryptoHash);
 * if (result.ok) {
 *   return { message: result.data };
 * }
 * throw createError({ statusCode: 400, message: result.reason });
 * ```
 *
 * @throws Never throws - all errors are returned as failed responses
 */
export async function askForMfaFlow(event: H3Event, log: pino.Logger, reason: string, random: string): Promise<UtilsResponse<string>> {
    const canary = getCookie(event, "canary_id");
    const refresh = getCookie(event, 'session');

    if (!canary || !refresh) {
        log.error("Missing Tokens")
        return {
            ok: false,
            date: new Date().toISOString(),
            reason: "Server error please try again later",
            code: "INVALID_CREDENTIALS"
        }
    }

    const cookies = [
            {label: `canary_id`,  value: canary},
            {label: `session`, value: refresh},
        ];

    if (random.length < 254 || random.length > 500) {
        log.error(`Hash to short or long. (Allowed min 254 to 500) Provided: ${random.length}`)
        return {
            ok: false,
            date: new Date().toISOString(),
            reason: 'Hash to short or long.',
            code: "HASH"
        }
    }
    if (reason.length > 100) {
        log.error(`Reason is to long. (Allowed 100) Provided: ${reason.length}`)
        return {
            ok: false,
            date: new Date().toISOString(),
            reason: 'Reason is to long',
            code: "REASON"
        }
    }
    try {
        const res = await safeAction(`${canary}_${reason}`, async () => {
            return await sendToServer(false, `/custom/mfa/${reason}?random=${encodeURIComponent(random)}`, 'POST', event, false, cookies)
        })
       if (!res) {
                log.error('Api Call Failed')
                return {
                    ok: false,
                    date: new Date().toISOString(),
                    reason: "Server error please try again later",
                    code: 'AUTH_SERVER_ERROR'
                }
       }
       log.info(`Got results, validating...`);  
        const results = await res.json() as Results<string>
       
       if (res.status === 401 || res.status === 400) {
            log.warn({...results}, 'Missing credentials or Bad data')
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: "Invalid email or password",
                code: 'INVALID_CREDENTIALS',
            }
        }

        if (res.status === 403) {
            log.warn({...results }, `User has been banned / blacklisted or bad client`)
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: 'Not allowed this time, please try again later.',
                code: 'FORBIDDEN'
            }
        }
        if (res.status === 429) {
            log.warn(`User rate limited`);  
            const retrySec = res.headers.get('Retry-After');
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: `Too many attempts, please try again later.`,
                code: "RATE_LIMIT",
                retryAfter: retrySec
            }
        };

        if (res.status === 500 || res.status !== 200) {
            log.error({...results}, `API Server Error`)
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: 'Something went wrong, please try restarting the page, and try again',
                code: 'AUTH_SERVER_ERROR'
            }
        }

        if (!results.ok) {
            log.warn({...results}, `Server rejected mfa flow request`)
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: 'Server rejected flow.',
                code: "AUTH_REJECTED"
            }
        }
        log.info({
            customMfaFlow: "success",
            serverResponse: results.data,
        }, "Server sended email to the user")

        return {
            ok: true,
            date: new Date().toISOString(),
            data: "Please check your email to complete the action."
        }
    } catch (err) {
            log.error({ err }, `Unexpected error type`)
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: 'Something went wrong, please try restarting the page, and try again',
                code: 'UNEXPECTED_ERROR'
            }
    }
}