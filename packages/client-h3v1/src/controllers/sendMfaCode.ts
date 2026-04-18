import { getLogger, validateZodSchema, verificationLink, VerificationLinkSchema } from "@internal/shared";
import { sendToServer } from "../utils/serverToServer.js";
import { makeCookie } from "../utils/cookieGenerator.js";
import { appendHeader, assertMethod, getCookie, getHeader, getQuery, getRouterParam, sendRedirect, setResponseStatus } from "h3";
import throwError from "../middleware/error.js";
import { getOperationalConfig } from "../utils/getRemoteConfig.js";
import { getConfiguration } from "@internal/shared";
import { defineDeduplicatedEventHandler } from "../utils/requestDedupHandler.js";

/**
 * Validates MFA code submissions by proxying them to the auth server, managing session cookies,
 * and returning appropriate redirect or error responses.
 *
 * @param event - H3 event wrapping the MFA verification request.
 * @returns Redirect to the configured success URL or JSON error feedback.
 *
 * @example
 * router.post('/auth/verify-mfa/:visitor', sendCode, { middleware: [...] });
 */
export default defineDeduplicatedEventHandler(async (event) => {
const { domain, accessTokenTTL } = await getOperationalConfig(event)
const { onSuccessRedirect } = getConfiguration()

assertMethod(event, "POST")
const query = getQuery<VerificationLinkSchema>(event)
const canary = getCookie(event, 'canary_id');

const log = getLogger().child({service: `auth`, branch: 'mfa', reqID: event.context.rid, canary_id: 
    getCookie(event, 'canary_id') });
    
const validation = validateZodSchema(verificationLink, query, log);

 if ('valid' in validation) {
        log.error({...validation.errors}, 'Validation failed');
        throwError(log,event, 'INVALID_CREDENTIALS',400, "Invalid data", "Invalid data", `Validation failed`);
  }

 const cookies = [{
        label: 'canary_id',
        value: canary
  }]

log.info(`Entered sendCode Post Route`)

const contentType = getHeader(event, 'Content-Type')!;

if (!contentType || contentType !== 'application/json') {
  throwError(log, event, 'INVALID_CONTENT_TYPE', 400, 'Invalid Content-Type', 'Content-Type must be application/json', `Received: ${contentType}`);
};

if (!canary) {
    throwError(log,event,'INVALID_CREDENTIALS',403,'FORBIDDEN', 'INVALID_CREDENTIALS', 'Invalid temp link token. Or canary is possibly undefined')
 }
    const body = event.context.body as {code: string | undefined}

  if (!body) {
      throwError(log,event,'MISSING_BODY',400, 'Invalid request body.', 'This field is required.', 'Invalid request body.')
  }

   const {code} = body;

    if (!code) {
      throwError(log,event,'INVALID_CREDENTIALS',400, 'Invalid code attempt', 'This field is required.', 'Invalid code attempt')
    }
    const { visitor, random, reason, token } = validation.data;
    log.info({ visitor, token, reason }, "Link parameters validated.");

    log.warn(`Sending code to server...`)
    const url = `/auth/verify-mfa/?visitor=${visitor}&token=${encodeURIComponent(token)}&random=${encodeURIComponent(random)}&reason=${reason}`
    const serverResponse = await sendToServer(false, url, 'POST', event, true, cookies, { code });  

    if (!serverResponse) {
        throwError(log,event,'SERVER_ERROR', 500, 'Server Error', 'Server error please try again later', 'Api Call Failed')
    };

    if (!serverResponse.ok) {
        log.warn({serverResponse: await serverResponse.json(), code: serverResponse.status},'Bad MFA code.')
        setResponseStatus(event,401)
        return {
            error: 'Invalid or expired code',
        }
    }


        const setCookies = serverResponse.headers.getSetCookie();
        const json = await serverResponse.json() as {
          accessIat?: any; accessToken?: string 
        };
        const accessToken = json.accessToken;
        const accessIat = json.accessIat;
        log.info({serverResponse: json, code: serverResponse.status},'MFA verification completed.')

       if (setCookies && accessToken) {
           setCookies.forEach(line => appendHeader(event, 'Set-Cookie', line));
           makeCookie(event, '__Secure-a', accessToken, {
               httpOnly: true,
               sameSite: 'strict',
               secure:   true,
               path: '/',
               domain: domain,
               maxAge: accessTokenTTL
           })
           makeCookie(event, 'a-iat', accessIat, {
                httpOnly: true,
                sameSite: 'strict',
                secure:   true,
                path: '/',
                domain: domain,
                maxAge: accessTokenTTL
            })
         log.info('Redirecting user...') 
        const wantsJSON = getHeader(event, 'accept')?.includes('application/json');
        if (wantsJSON) { 
         setResponseStatus(event, 200)
         return { 
            ok: true,
            date: new Date().toISOString(),
            data: {
                redirectTo: onSuccessRedirect 
            }
          }
        }
        return sendRedirect(event, onSuccessRedirect, 303);
       }  

    log.warn({serverResponse: json, status: serverResponse.status},'Something went wrong')
    setResponseStatus(event, 400)
    return {
     error: 'Invalid or expired code'
    }
})

