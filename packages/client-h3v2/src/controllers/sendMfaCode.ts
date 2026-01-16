import { getLogger } from "@internal/shared";
import { sendToServer } from "../utils/serverToServer.js";
import { makeCookie } from "../utils/cookieGenerator.js";
import { assertMethod, defineHandler, getCookie, getQuery, getRouterParam, redirect } from "h3";
import throwError from "../middleware/error.js";
import { getOperationalConfig } from "../utils/getRemoteConfig.js";
import { getConfiguration } from "@internal/shared";

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
export default defineHandler(async (event) => {
const { domain, accessTokenTTL } = await getOperationalConfig(event)
const { onSuccessRedirect } = getConfiguration()

assertMethod(event, "POST")
const { temp } = getQuery(event)
const visitor = getRouterParam(event, "visitor");

const log = getLogger().child({service: `auth`, branch: 'mfa', reqID: event.context.rid, temp: temp, visitor: visitor, canary_id: 
    getCookie(event, 'canary_id') })

    const cookies = {
    label: 'canary_id',
    value: getCookie(event, 'canary_id')
}

log.info(`Entered sendCode Post Route`)

const contentType = event.req.headers.get('Content-Type')!;

if (!contentType || contentType !== 'application/json') {
  throwError(log, event, 'INVALID_CONTENT_TYPE', 400, 'Invalid Content-Type', 'Content-Type must be application/json', `Received: ${contentType}`);
};

if (!cookies.value || typeof temp !== "string" || !temp) {
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

    log.warn(`Sending code to server...`)

    const serverResponse = await 
    sendToServer(false, `/auth/verify-mfa/${visitor}?temp=${encodeURIComponent(temp)}`, 'POST', event, true, cookies, { code });

    if (!serverResponse) {
        throwError(log,event,'SERVER_ERROR', 500, 'Server Error', 'Server error please try again later', 'Api Call Failed')
    };

    if (!serverResponse.ok) {
        log.warn({serverResponse: await serverResponse.json(), code: serverResponse.status},'Bad MFA code.')
        event.res.status = 401
        return {
            error: 'Invalid or expired code',
        }
    }


        const setCookies = serverResponse.headers.getSetCookie();
        const json = await serverResponse.json() as {
          accessIat?: any; accessToken?: string 
        };
        const accessToken = json.accessToken;
        const accessIat   = json.accessIat;
        log.info({serverResponse: json, code: serverResponse.status},'MFA verification completed.')

       if (setCookies && accessToken) {
           setCookies.forEach(line => event.res.headers.append('Set-Cookie', line));
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
        const wantsJSON = event.req.headers.get('accept')?.includes('application/json');
        if (wantsJSON) { 
         event.res.status = 200; 
         return { 
            ok: true,
            redirectTo: onSuccessRedirect 
          }
        }
        return redirect(onSuccessRedirect, 303);
       }  

    log.warn({serverResponse: json, status: serverResponse.status},'Something went wrong')
    event.res.status = 400
    return {
     error: 'Invalid or expired code'
    }
})

