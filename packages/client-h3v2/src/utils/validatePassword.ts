import { getCookie, H3Event } from "h3";
import pino from "pino";
import { sendToServer } from "./serverToServer.js";
import { safeAction, type UtilsResponse, type AuthServerLoginResponse } from "@internal/shared";

/**
 * Validates a user's password by making a request to the auth server.
 * 
 * @param password - The user's password.
 * @param email - The user's email address.
 * @param log - Pino logger instance for tracking the request.
 * @param event - H3 event for request context and cookie access.
 * @returns A promise resolving to a UtilsResponse object.
 */
export async function validateUserPassword(
    password: string, 
    email: string, 
    log: pino.Logger, 
    event: H3Event
): Promise<UtilsResponse<string>> {
    const canary = getCookie(event, "canary_id");

    if (!canary) {
        log.error("Missing canary id")
        return {
            ok: false,
            date: new Date().toISOString(),
            reason: "Server error please try again later"
        }
    }
    try {
        const res = await safeAction(`${canary}:${email.slice(0, 10)}`, async () => {
           return await sendToServer(false, '/login', "POST", event, true, { value: canary, label: 'canary_id' }, {email, password});
        })

        if (!res) {
                log.error('Api Call Failed')
                return {
                    ok: false,
                    date: new Date().toISOString(),
                    reason: "Server error please try again later"
                }
        }

        log.info(`Got results, validating...`);  
        
        if (res.status === 401 || res.status === 400) {
            log.warn('Invalid email or password entered')
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: "Invalid email or password",
                code: 'INVALID_CREDENTIALS',
            }
        }

        if (res.status === 403) {
            log.warn(`User has been banned / blacklisted`)
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

    if (res.status === 500) {
        log.error(`API Server Error`)
        return {
            ok: false,
            date: new Date().toISOString(),
            reason: 'Something went wrong, please try restarting the page, and try again',
            code: 'AUTH_SERVER_ERROR'
        }
    }
            const results = await res.json() as AuthServerLoginResponse;

            const cookies = res.headers.getSetCookie();
            const accessToken = results.accessToken;
            const accessIat = results.accessIat;

            if (cookies.length === 0 || !accessToken || !accessIat) {
                log.error({ 
                    cookiesCount: cookies.length, 
                    hasAccessToken: !!accessToken,
                    hasAccessIat: !!accessIat
                }, "Refresh token or access token is undefined");
                
                return {
                    ok: false,
                    date: new Date().toISOString(),
                    reason: 'Something went wrong, please try restarting the page, and try again',
                    code: 'SERVER_ERROR'
                }
            } 

            log.info({ 
                accessIat: results.accessIat,
                hasAccessToken: !!results.accessToken,
                cookiesCount: cookies.length
            }, `User entered a valid password, action allowed`)

            return {
                ok: true,
                date: new Date().toISOString(),
                data: 'Allowed'
            }
    } catch(err) {
            log.error({ err }, `Unexpected error type`)
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: 'Something went wrong, please try restarting the page, and try again',
                code: 'UNEXPECTED_ERROR'
            }
    }
}