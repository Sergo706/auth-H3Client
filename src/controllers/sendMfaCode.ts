import { getLogger } from "../utils/logger.js";
import { sendToServer } from "../utils/serverToServer.js";
import { makeCookie } from "../utils/cookieGenerator.js";
import { assertMethod, defineHandler, getCookie, getQuery, getRouterParam, readBody } from "h3";
import throwError from "../middleware/error.js";
import { getConfiguration } from "../config/config.js";

export default defineHandler(async (event) => {
const config = getConfiguration();

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
               domain: config.domain,
               maxAge: 16 * 60 * 1000
           })
           makeCookie(event, 'a-iat', accessIat, {
                httpOnly: true,
                sameSite: 'strict',
                secure:   true,
                path: '/',
                domain: config.domain,
                maxAge: 16 * 60 * 1000
            })
         log.info('Redirecting user...') 
         event.res.status = 200
         return {
            success: true,
            ans: 'Verification succeeded!'
         }
       }  

    log.warn({serverResponse: json, status: serverResponse.status},'Something went wrong')
    event.res.status = 400
    return {
     error: 'Invalid or expired code'
    }
})



