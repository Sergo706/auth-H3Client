import { sendToServer } from "../utils/serverToServer.js";
import { getLogger, VerificationLinkSchema, verificationLink, validateZodSchema, safeAction, parseResponseContentType } from "@internal/shared";
import { notFoundHandler } from "../middleware/notFound.js"
import { defineEventHandler, getCookie, getQuery } from "h3";
import throwError from "../middleware/error.js";
import type { LinkPasswordVerificationResponse } from "@internal/shared";
/**
 * Validates temporary links (MFA or password reset) by confirming signed tokens with the auth server
 * and returning structured metadata or falling back to not-found responses.
 *
 * @param event - H3 event for the temporary link verification request.
 * @returns JSON metadata with the link action or redirects/not-found when invalid.
 *
 * @example
 * router.get('/auth/verify-mfa/:visitor', verifyLink);
 */
export default defineEventHandler(async (event) => {

const query = getQuery<VerificationLinkSchema>(event)

const log = 
getLogger().child(
    {
    service: `auth`,
    branch: `tempLinks`,
    reqID: event.context.rid,
    canary_id: getCookie(event, 'canary_id') 
    });

   log.info('Entered Link Verifier')
    const canary = getCookie(event, 'canary_id');

    if (!canary) {
       log.warn('Invalid temp link token. Or canary is possibly undefined')
        throwError(log,event,'FORBIDDEN',401, "UnAuthorized", "Un Authorized",`Missing credentials`);
    }
    
    const cookies = [{
        label: 'canary_id',
        value: canary
    }]

    const validation = validateZodSchema(verificationLink, query, log);

    if ('valid' in validation) {
        log.error({...validation.errors}, 'Validation failed');
        throwError(log,event, 'INVALID_CREDENTIALS',400, "Invalid data", "Invalid data", `Validation failed`);
   }

    const { visitor, random, reason, token } = validation.data;
    const url = `/auth/reset-password/?visitor=${visitor}&token=${encodeURIComponent(token)}&random=${encodeURIComponent(random)}&reason=${reason}`

    const res = await safeAction(`${canary}:${random}${visitor}`, async () => { 
        return await sendToServer(false, url,'GET', event, false, cookies)
    })

    if (!res) {
        throwError(log,event,'SERVER_ERROR', 500, 'Server Error', 'Server error please try again later', 'Api Call Failed')
    };

    const results = await parseResponseContentType(log, res) as LinkPasswordVerificationResponse;


    if (res.ok && results && 'ok' in results && results.ok && res.status === 200) {
        log.info(`Link verified with a GET reqs. context is set.`);
        return {
            ok: true,
            date: results.date,
            data: results.data
        }
      }

 
    log.info( {...results},`link verification failed: invalid link`)
    return notFoundHandler(event);
})
