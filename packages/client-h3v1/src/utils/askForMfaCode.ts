import pino from "pino";
import { Results, safeAction, type UtilsResponse } from "@internal/shared";
import { getCookie, H3Event } from "h3";
import { sendToServer } from "./serverToServer.js";
export interface MfaResponse { mfaRequired?: string; mfa?: boolean; message: string };
/**
 * Initiates a custom MFA verification flow by requesting the auth server to send
 * a verification email to the user.
 * Requires a fully authenticated and health session to succeed, will throw "MFA_REQUIRED" if the current session is not health and start an mfa flow.
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
 * @param accessToken - Provide an access token. If not provided will attempts to get it from the cookie, throws "INVALID_CREDENTIALS" if missing
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
export async function askForMfaFlow(event: H3Event, log: pino.Logger, reason: string, random: Buffer | NonSharedBuffer, accessToken?: string): Promise<UtilsResponse<string>> {
    const canary = getCookie(event, "canary_id");
    const refresh = getCookie(event, 'session');
    const token = getCookie(event, '__Secure-a') ?? accessToken;

    if (!canary || !refresh || !token) {
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

    if (!Buffer.isBuffer(random)) {
        log.error(`Random is not a buffer. provided: ${random}`)
        return {
            ok: false,
            date: new Date().toISOString(),
            reason: 'Random is not a buffer.',
            code: "HASH"
        }
    }
    if (random.toString('hex').length < 254 || random.toString('hex').length > 500) {
        log.error(`Hash to short or long. (Allowed min 254 to 500) Provided: ${random.toString('hex').length}`)
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
        const resultsCache = await safeAction(`${canary}_${reason}`, async () => {

             const res = await sendToServer(false, `/custom/mfa/${reason}?random=${encodeURIComponent(random.toString('hex'))}`, 'POST', event, true, cookies, {}, token)

             if (!res) return null;
             const results = await res.json() as Results<string> | MfaResponse;

             return {
                 status: res.status,
                 retryAfter: res.headers.get('Retry-After'),
                 results
             }
        })

        if (!resultsCache) {
                log.error(`Api Call Failed: resultsCache is null for canary ${canary} and reason ${reason}. This usually means sendToServer failed or timed out.`)
                return {
                    ok: false,
                    date: new Date().toISOString(),
                    reason: "Server error please try again later",
                    code: 'AUTH_SERVER_ERROR'
                }
        }

        const { status, results, retryAfter } = resultsCache;
        log.info(`Got results, validating...`);  
       
       if (status === 401 || status === 400) {
            log.warn({...results}, 'Missing credentials or Bad data')
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: "Invalid email or password",
                code: 'INVALID_CREDENTIALS',
            }
        }

        if (status === 202 && ("mfaRequired" in results || "mfa" in results)) {
            log.info(`Anomaly detected, standard MFA required first.`);
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: results.message || "Please verify your session first. check your email.",
                code: "MFA_REQUIRED", 
            }
        }

        if (status === 403) {
            log.warn({...results }, `User has been banned / blacklisted or bad client`)
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: 'Not allowed this time, please try again later.',
                code: 'FORBIDDEN'
            }
        }
        if (status === 429) {
            log.warn(`User rate limited`);  
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: `Too many attempts, please try again later.`,
                code: "RATE_LIMIT",
                retryAfter: retryAfter ?? undefined
            }
        };

        if (status === 500 || status !== 200) {
            log.error({...results}, `API Server Error`)
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: 'Something went wrong, please try restarting the page, and try again',
                code: 'AUTH_SERVER_ERROR'
            }
        }

        if (!("ok" in results)) {
            log.error({...results}, `Unexpected data or error type`)
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