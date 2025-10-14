import { makeCookie } from "../utils/cookieGenerator.js";
import { sendToServer } from '../utils/serverToServer.js';
import { getLogger } from '../utils/logger.js';
import { assertMethod, defineHandler, getRequestIP, readBody, redirect } from "h3";
import throwError from "../middleware/error.js";
import { getOperationalConfig } from "../utils/getRemoteConfig.js";
import { getConfiguration } from "../config/config.js";

/**
 * Handles login submissions by validating payloads, proxying the request to the
 * authentication server, and setting issued cookies or reporting validation errors.
 *
 * @param event - Incoming H3 event containing the request context.
 * @returns A redirect response or JSON result describing the login outcome.
 *
 * @example
 * // In an H3 router:
 * router.post('/login', loginHandler, { middleware: [...] });
 */
export default defineHandler(async (event) => {

assertMethod(event, "POST")
const log = getLogger().child({service: 'auth', branch: 'classic', type: 'login', ip: getRequestIP(event)});
const { domain, accessTokenTTL } = await getOperationalConfig(event)
const { onSuccessRedirect } = getConfiguration()

log.info(`Got user data sending to server....`);

const contentType = event.req.headers.get('Content-Type')!;

if (!contentType || contentType !== 'application/json') {
  throwError(log, event, 'INVALID_CONTENT_TYPE', 400, 'Invalid Content-Type', 'Content-Type must be application/json', `Received: ${contentType}`);
};

const body = event.context.body as {email: string, password: string, rememberUser: string};

  if (!body) {
      throwError(log,event,'MISSING_BODY',400, 'Invalid request body.', 'This field is required.', 'Invalid request body.')
  }

const {email, password, rememberUser } = body;

if (!email || !password) {
        log.warn(`One or more fields are empty. or content type is not json.`)
        event.res.status = 400
        return { error: `This field is required.` };
}

try {
    const sendData = await sendToServer(false, `/login`, 'POST', event, true, undefined, {email, password});

    if (!sendData) {
        throwError(log,event,'SERVER_ERROR', 500, 'Server Error', 'Server error please try again later', 'Api Call Failed')
    };

        log.info(`Got results, validating...`);  

    if (sendData.status === 401 || sendData.status === 400) {
        throwError(log,event,'INVALID_CREDENTIALS',401,'INVALID_CREDENTIALS','Invalid email or password','Invalid email or password entered')
    }

    if (sendData.status === 403) {
        throwError(log,event,'FORBIDDEN',403,'FORBIDDEN', 'Not allowed this time, please try again later.', `User has been banned / blacklisted`)
    }

    if (sendData.status === 429) {
        log.warn(`User rate limited`);  
        const retrySec = sendData.headers.get('Retry-After');

        if (retrySec) {
            event.res.headers.append('Retry-After', retrySec)
            event.res.status = 429
            return {error: `To many attempts, please try again later.`};
        } 

            event.res.status = 429
            return {error: `To many attempts, please try again later.`};
    };

    if (sendData.status === 500) {
    throwError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', 
                  `API Server Error`);
    }

     log.info(`User validated, parsing...`);  
     const results = await sendData.json() as any;

    const cookies = sendData.headers.getSetCookie();
    const accessToken = results.accessToken;
    const accessIat = results.accessIat;

    if (cookies.length === 0 || !accessToken) {
        throwError(log, event, 'SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', 
                  `Refresh token or access token is undefined.\n RefreshToken: ${cookies.length}\n AccessToken: ${accessToken ? "Exists" : "Undefined"}`);
     } 

        cookies.forEach(line => event.res.headers.append('Set-Cookie', line));
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
        log.info({server: results}, `user is logged in successfully`)     
        const wantsJSON = event.req.headers.get('accept')?.includes('application/json');

        if (wantsJSON) { 
         event.res.status = 200; 
         return { 
            ok: true,
            redirectTo: onSuccessRedirect 
          }
        }
        
        return redirect(event, onSuccessRedirect, 303);

} catch(err) {
    throwError(log,event,'SERVER_ERROR',500,`Unexpected error`,`An error occurred please try again later.`,`Unexpected error ${err}`)    
}
})
