import { getLogger, type UtilsResponse, validateZodSchema, dataSchema, type UpdateEmailSchemaType, safeAction, parseResponseContentType, VerificationLinkSchema, verificationLink, RotationResult } from '@internal/shared'
import throwHttpError from '../middleware/error.js';
import { limitBytes } from '../middleware/limitBytes.js';
import { getOperationalConfig } from '../utils/getRemoteConfig.js';
import { applyRotationResult } from '../utils/applyRotationResults.js';
import { MfaResponse } from '../utils/defineAuthRoute.js';
import { defineVerifiedCsrfHandler } from '../utils/csrfVerifier.js';
import { sendToServer } from '../utils/serverToServer.js'
import { assertMethod, getCookie, getHeader, getQuery } from 'h3'


/**
 * Finalizes the email update process by verifying the MFA code and rotating credentials.
 * 
 * This controller:
 * 1. Validates the session and `Content-Type`.
 * 2. Validates query parameters (`visitor`, `random`, `temp`) and body (`code`, `password`, `newEmail`).
 * 3. Ensures the user is fully authenticated.
 * 4. Calls the upstream Auth Server to verify the MFA code and update the email.
 * 5. Handles token rotation upon success.
 * 
 * @param event - The H3 event object containing the request.
 * @returns A promise resolving to a `UtilsResponse` confirming the email update.
 *          If "anomaly detected", it may return an `MFA_REQUIRED` challenge.
 * 
 * @throws {H3Error} Throws HTTP errors for:
 * - 400: Invalid data, validation failure, or incorrect code/password.
 * - 401: Unauthorized session.
 * - 500: Upstream server errors.
 */
export default defineVerifiedCsrfHandler(async (event): Promise<UtilsResponse<string>> => {

    const log = getLogger().child({ service: 'auth-client', branch: 'email-update' })
    assertMethod(event, "POST")
    await limitBytes(8000000)(event);
    const contentType = getHeader(event, 'Content-Type')!;

    if (!contentType || contentType !== 'application/json') {
        throwHttpError(log, event, 'INVALID_CONTENT_TYPE', 400, 'Invalid Content-Type', 'Content-Type must be application/json', `Received: ${contentType}`);
    };
    const query = getQuery<VerificationLinkSchema>(event)
    const canary = getCookie(event, 'canary_id');
    const refresh = getCookie(event, 'session');
    const token = getCookie(event, '__Secure-a') ?? event.context.accessToken;


    if (!canary || !refresh || !token) {
        log.error({
            refreshExists: refresh ? true : false,
            canaryExists: canary ? true : false, 
            tokenExists: token ? true : false
         });
        throwHttpError(log,event,'FORBIDDEN',401, "UnAuthorized", "Un Authorized",`Missing credentials`);
    }

    const user = event.context.authorizedData;
    if (!user) {
        throwHttpError(log,event,'AUTH_REQUIRED',401,'UnAuthorized', 'Un Authorized action',`Un Authorized action detected.`);
    }
    
    const id = user.userId;
    if (!id || isNaN(Number(id))) {
        throwHttpError(log,event,'AUTH_CLIENT_ERROR',400,'Bad request', '',`Failed to get userId.
        `);
    }

    const queryValidation = validateZodSchema(verificationLink, query, log);

    if ('valid' in queryValidation) {
        log.error({...queryValidation.errors}, 'Query Validation failed');
        throwHttpError(log,event, 'INVALID_CREDENTIALS',400, "Invalid data", "Invalid data", `Validation failed`);
    }

    const body = event.context.body as UpdateEmailSchemaType;
    const bodyValidation = validateZodSchema(dataSchema, body, log);

    if ('valid' in  bodyValidation) {
        log.error({ ... bodyValidation.errors }, 'Body Validation failed');
        throwHttpError(log, event, 'INVALID_CREDENTIALS', 400, "Invalid data", "Invalid data", `Validation failed`);
    }

    const { visitor, temp, random, reason } = queryValidation.data;
    const { code }  = bodyValidation.data;
    const payload = { ...bodyValidation.data, code }; 
    const cookies = [{label: 'canary_id', value: canary}, { label: 'session', value: refresh }];

    const url = `/update/email?visitor=${visitor}&temp=${encodeURIComponent(temp)}&random=${encodeURIComponent(random)}&reason=${reason}`
    const res = await safeAction(refresh ?? canary!, async () => {
         return await sendToServer(false, url, "POST", event, true, cookies, payload, token)
    })

    if (!res) {
        throwHttpError(log,event, "AUTH_SERVER_ERROR", 500, "Server Error", "Server error please try again later", 'Api Call Failed')
    }
    
    const results = await parseResponseContentType(log, res) as { accessIat?: string; accessToken?: string; error?: string } | MfaResponse

    if (!res.ok || res.status !== 200 && res.status < 500) {
        log.warn({status: res.status, ...results}, "Update failed");
        throwHttpError(log,event, "ERROR", res.status, "Update Failed", "Invalid email, password or code", 'Update Failed')
    }

    if (res.status === 500) {
        log.warn({status: res.status, ...results}, "Server error");
        throwHttpError(log,event, "AUTH_SERVER_ERROR", 500, "Server Error", "Server error please try again later", 'Api Call Failed')
    }
    
    if (res.status === 202 && "mfaRequired" in results) {
            log.info(`Anomaly detected, standard MFA required first.`);
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: results.message || "Please verify your session first. check your email.",
                code: "MFA_REQUIRED", 
            }
    }

     const setCookies = res.headers.getSetCookie();
     const successResults = results as { accessIat?: string; accessToken?: string; error?: string };
     const accessToken = successResults.accessToken;
     const accessIat = successResults.accessIat;

    if (setCookies.length === 0 || !accessIat || !accessToken) {
            throwHttpError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', `New refresh token and related cookies ended up null`);
    }
    const sessionLine = setCookies.find(c => c.trim().startsWith('session=')) ?? '';
    const sessionValue = sessionLine.split(';', 1)[0].split('=')[1]
    
    const mfaResults: RotationResult = {
        type: 'both',
        newToken: accessToken,
        newRefresh: sessionValue,
        accessIat: accessIat,
        rawSetCookie: setCookies,
    }
    log.info({serverResponse: res, code: res.status},'Email updated successfully');
    const { domain, accessTokenTTL } = await getOperationalConfig(event);
    applyRotationResult(event, mfaResults, domain, accessTokenTTL);
    return {
      ok: true,
      date: new Date().toISOString(),
      data: "Your email has been successfully updated."
    };
})