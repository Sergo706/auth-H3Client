import { ResponseSign } from "../types/signup.js";
import { banIp } from "../utils/banIp.js";
import { makeCookie } from "../utils/cookieGenerator.js";
import { sendToServer } from '../utils/serverToServer.js';
import { getLogger } from '../utils/logger.js';
import { appendHeader, assertMethod, defineEventHandler, getCookie, getHeader, getRequestIP, sendRedirect, setResponseStatus } from "h3";
import throwError from "../middleware/error.js";
import { getOperationalConfig } from "../utils/getRemoteConfig.js";
import { getConfiguration } from "../config/config.js";

/**
 * Handles user signup by validating the payload, delegating to the auth server,
 * managing issued cookies, and translating server responses into structured errors.
 *
 * @param event - H3 event for the signup request.
 * @returns Redirect to the success URL or a JSON error payload.
 *
 * @example
 * router.post('/signup', signupHandler, { middleware: [...] });
 */
export default defineEventHandler(async (event) => {

const log = getLogger().child({service: 'auth', branch: 'classic', type: 'signup'});
const { domain, accessTokenTTL } = await getOperationalConfig(event)
const { onSuccessRedirect } = getConfiguration()

assertMethod(event, "POST")


log.info(`Got user data sending to server....`)

const contentType = getHeader(event, 'Content-Type')!;

if (!contentType || contentType !== 'application/json') {
  throwError(log, event, 'INVALID_CONTENT_TYPE', 400, 'Invalid Content-Type', 'Content-Type must be application/json', `Received: ${contentType}`);
};

const body = event.context.body

  if (!body) {
      throwError(log,event,'MISSING_BODY',400, 'Invalid request body.1234', 'This field is required.', 'Invalid request body.')
  }

for (const [key, value] of Object.entries(body)) {
    if (!value && key !== 'rememberUser') {
        log.warn({key},`One more fields are empty..`)
        throwError(log,event,'MISSING_BODY',400, 'Invalid request body123.', 'This field is required.', 'One or more required fields are empty..')
    }
}

    const cookies = [
        {
          label: `canary_id`,
          value: getCookie(event, 'canary_id')
        }
      ]
  
try {
const sendData = await sendToServer(false, `/signup`, "POST", event, true, cookies, body) 
        if (!sendData) {
        throwError(log,event,'SERVER_ERROR', 500, 'Server Error', 'Server error please try again later', 'Api Call Failed')
    };

 const results = await sendData.json() as ResponseSign; 
 log.info(`Got results, validating...`)  

    if (sendData.status === 201) {
        const cookies = sendData.headers.getSetCookie();
        const accessToken = results.accessToken;
        const accessIat   = results.accessIat;
        
        if (cookies && accessToken) {
            cookies.forEach(line => appendHeader(event, 'Set-Cookie', line));
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
        }   
        log.info({server: results}, `user is signed up successfully`) 
        const wantsJSON = getHeader(event, 'accept')?.includes('application/json');
        if (wantsJSON) { 
         setResponseStatus(event, 201) 
         return { 
            ok: true,
            redirectTo: onSuccessRedirect 
          }
        }
        return sendRedirect(event, onSuccessRedirect, 303);
    } 

    if (sendData.status === 403 && results.banned) {
            banIp(getRequestIP(event)!);
            throwError(log,event,'FORBIDDEN',403,'FORBIDDEN','NOT_ALLOWED', `Banned XSS attempt from frontend.`)
    }

    if (sendData.status === 400) {
     if (results.inputError) {
        log.info({error: results.inputError}, `Input error`) 
        setResponseStatus(event, 400) 
        return {
            ok: false,
            receivedAt: new Date().toISOString(),
            error: results.inputError
        }
    } else {
       setResponseStatus(event, 400)
        return {
            ok: false,
            receivedAt: new Date().toISOString(),
            error: results.inputError
        }
    }
}

    if (sendData.status === 409 && results.error) {
        log.info({error: results.error}, `Schema error`) 
        setResponseStatus(event, 409) 
        return {
            ok: false,
            receivedAt: new Date().toISOString(),
            error: results.error
        }
    }
       
     if (sendData.status === 500) {
          throwError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', 
                  `API Server Error`);
     }   
        
}  catch(err) {
    throwError(log,event,'SERVER_ERROR',500,`Unexpected error`,`An error occurred please try again later.`,`Unexpected error ${err}`)  
}
})
