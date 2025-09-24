import { ResponseSign } from "../types/signup.js";
import { banIp } from "../utils/banIp.js";
import { makeCookie } from "../utils/cookieGenerator.js";
import { sendToServer } from '../utils/serverToServer.js';
import { getLogger } from '../utils/logger.js';
import { assertMethod, defineHandler, getCookie, getRequestIP, readBody } from "h3";
import { getConfiguration } from "../config/config.js";
import throwError from "../middleware/error.js";


export default defineHandler(async (event) => {

const log = getLogger().child({service: 'auth', branch: 'classic', type: 'signup'});
const config = getConfiguration()
assertMethod(event, "POST")


log.info(`Got user data sending to server....`)

const contentType = event.req.headers.get('Content-Type')!;

if (!contentType || contentType !== 'application/json') {
  throwError(log, event, 'INVALID_CONTENT_TYPE', 400, 'Invalid Content-Type', 'Content-Type must be application/json', `Received: ${contentType}`);
};

const body = event.context.body

  if (!body) {
      throwError(log,event,'MISSING_BODY',400, 'Invalid request body.', 'This field is required.', 'Invalid request body.')
  }

for (const [key, value] of Object.entries(body)) {
    if (!value && key !== 'rememberUser') {
        log.warn({key},`One more fields are empty..`)
        throwError(log,event,'MISSING_BODY',400, 'Invalid request body.', 'This field is required.', 'One or more required fields are empty..')
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
            cookies.forEach(line => event.res.headers.append('Set-Cookie', line));
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
        }   
        log.info({server: results}, `user is signed up successfully`) 
        event.res.status = 201
        return {
            ok: true,
            receivedAt: new Date().toISOString()
        }
    } 

    if (sendData.status === 403 && results.banned) {
            banIp(getRequestIP(event)!);
            throwError(log,event,'FORBIDDEN',403,'FORBIDDEN','NOT_ALLOWED', `Banned XSS attempt from frontend.`)
    }

    if (sendData.status === 400) {
     if (results.inputError) {
        log.info({error: results.inputError}, `Input error`) 
        event.res.status = 400
        return {
            ok: false,
            receivedAt: new Date().toISOString(),
            error: results.inputError
        }
    } else {
        event.res.status = 400
        return {
            ok: false,
            receivedAt: new Date().toISOString(),
            error: results.inputError
        }
    }
}

    if (sendData.status === 409 && results.error) {
        log.info({error: results.error}, `Schema error`) 
        event.res.status = 409
        return {
            ok: false,
            receivedAt: new Date().toISOString(),
            error: results.error
        }
    }
       
     if (sendData.status === 500) {
        log.info({error: 500}, `Server Error`)
        event.res.status = 500
        return {
            ok: false,
            receivedAt: new Date().toISOString(), 
            error: 'Server Error' 
        }
     }   
        
}  catch(err) {
    throwError(log,event,'SERVER_ERROR',500,`Unexpected error`,`An error occurred please try again later.`,`Unexpected error ${err}`)  
}
})
