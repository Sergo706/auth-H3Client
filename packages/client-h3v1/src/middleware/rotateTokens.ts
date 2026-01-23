import { appendHeader, getCookie, H3Event, setResponseStatus } from "h3";
import { getLogger } from "@internal/shared";
import throwError from "./error.js";
import { sendToServer } from "../utils/serverToServer.js";
import { getMetadata } from "../utils/getAccessTokenMetaData.js";
import { cache } from "../utils/getAccessTokenMetaData.js";
import { parseResponseContentType, safeAction, type RotationResult } from "@internal/shared";
import { H3Error } from 'h3';
import { getOperationalConfig } from "../utils/getRemoteConfig.js";
import { applyRotationResult } from "../utils/applyRotationResults.js";

/**
 * Ensures both access and refresh credentials remain valid by consulting cached metadata
 * and rotating tokens through the auth server when required.
 *
 * @param event - H3 event containing the current session context.
 * @returns JSON payload describing MFA or rotation responses, or void when tokens remain valid.
 *
 * @example
 * await ensureValidCredentials(event);
 */
export async function ensureValidCredentials(event: H3Event) {
    const log = getLogger().child({service: 'auth', branch: `TokensRotation`, reqID: event.context.rid })
    const { domain, accessTokenTTL } = await getOperationalConfig(event)
    
    const currentToken = getCookie(event, '__Secure-a');
    const refresh = getCookie(event, 'session');
    const canary = getCookie(event, 'canary_id');

    if (!refresh || !canary) {
        throwError(log, event, 'AUTH_REQUIRED', 401, 'Unauthorized','Re-authentication required', 'No refresh token is found Re-authentication required.');
    }

    const rotateBoth = async (): Promise<RotationResult> => {
        log.info('No access token found. Generating a new token pair')
        const cookies = [
            {label: `canary_id`,  value: canary},
            {label: `session`, value: refresh},
        ]    

        try {
            log.info('Sending Request To api...')
            const res = await sendToServer(false, '/auth/refresh-session/rotate-every', 'POST', event, false, cookies)
            
            if (!res) {
                throwError(log, event, 'SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', 'Api Call Failed');
            }
            const json = await parseResponseContentType(log, res);

            if (res.status === 429) {
                log.warn(`User rate limited`);  
                const retrySec = res.headers.get('Retry-After');
                if (retrySec) {
                    appendHeader(event, 'Retry-After', (retrySec as unknown as number))
                }
                setResponseStatus(event, 429)
                return { error: `Too many attempts, please try again later.` };
            }

            if (res.status === 401) {
                throwError(log, event, 'AUTH_REQUIRED', 401, 'Unauthorized','Re-authentication required', `Re-authentication required. \n ${json.message} \n ${json.error}`);
            }

            if (res.status === 202) {
                setResponseStatus(event, 202, "OK")
                return {
                    text: 'MFA required',
                    message: json.message
                }
            }

            if (res.status === 500 || !res.ok || res.status !== 201) {
                throwError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', 
                    `Api Call Failed \n ${json.error}`);
            }

            const newToken = json.accessToken as string;
            const accessIat = json.accessIat as string;
            const rawSetCookie = res.headers.getSetCookie() || []; 

            if (rawSetCookie.length === 0 || !accessIat || !newToken) {
                throwError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', `New refresh token and related cookies ended up null`);
            }

            const sessionLine = rawSetCookie.find(c => c.trim().startsWith('session=')) ?? '';
            const sessionValue = sessionLine.split(';', 1)[0].split('=')[1] || refresh;

            return { newToken, newRefresh: sessionValue, accessIat, rawSetCookie };
        } catch(err) {
            if (err instanceof H3Error) throw err;
            throwError(log, event, 'SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', `Unexpected error type. ${err}`);
        }
    }

    const rotateAndApply = async () => {
        const result = await safeAction(refresh, rotateBoth);
        return applyRotationResult(event, result, domain, accessTokenTTL);
    };

    if (!currentToken) {
        log.info('No access token; rotating both tokens');
        return await rotateAndApply();
    }

    try {
        const meta = await getMetadata(log, false, currentToken, refresh, canary, event);
        
        if ("serverError" in meta && meta.serverError) {
            log.info('Meta resolved with an error; rotating both tokens');
            cache.del(currentToken);
            return await rotateAndApply();
        }

        if ("mfa" in meta && meta.mfa) {
            setResponseStatus(event, 202, "OK")
            return { text: 'MFA required' }
        }

        if ("authorized" in meta && !meta.authorized) {
            log.info('Meta not authorized; rotating both tokens');
            cache.del(currentToken);
            return await rotateAndApply();
        }

        if ("shouldRotate" in meta && meta.shouldRotate) {
            log.info({ msUntilExp: meta.msUntilExp }, 'Meta suggests rotation; rotating both tokens');
            cache.del(currentToken);
            return await rotateAndApply();
        }
        
        event.context.session = refresh;
        event.context.accessToken = currentToken;
    } catch (err) {
        log.warn({ err }, 'Meta check failed; rotating both tokens');
        cache.del(currentToken);
        return await rotateAndApply();
    }
}
