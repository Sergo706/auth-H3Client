import { deleteCookie, getCookie, H3Event } from "h3";
import { getLogger } from "../utils/logger.js";
import throwError from "./error.js";
import { sendToServer } from "../utils/serverToServer.js";
import { makeCookie } from "../utils/cookieGenerator.js";
import { getMetadata } from "../utils/getAuthorizedMetaData.js";
import { cache } from "../utils/getAuthorizedMetaData.js";
import { parseResponseContentType } from "../utils/checkResponseType.js";
import { HTTPError } from 'h3';
import { getOperationalConfig } from "../utils/getRemoteConfig.js";

  export async function ensureValidCredentials(event: H3Event) {
    const log = getLogger().child({service: 'auth', branch: `TokensRotation`, reqID: event.context.rid })
    const { domain, accessTokenTTL } = await getOperationalConfig(event)
    
    let currentToken = getCookie(event, '__Secure-a');
    let refresh = getCookie(event, 'session');
    const canary = getCookie(event, 'canary_id');


   if (!refresh || !canary) {
    throwError(log, event, 'AUTH_REQUIRED', 401, 'Unauthorized','Re-authentication required', 'No refresh token is found Re-authentication required.');
    }

    const rotateBoth = async () => {
    log.info('No access token found Generating a new token pair')
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
                event.res.headers.append('Retry-After', retrySec)
                event.res.status = 429
                return {error: `To many attempts, please try again later.`};
            } 

                event.res.status = 429
                return {error: `To many attempts, please try again later.`};
        };

        if (res.status === 401) {
          throwError(log, event, 'AUTH_REQUIRED', 401, 'Unauthorized','Re-authentication required', `Re-authentication required. \n ${json.message} \n ${json.error}`);
        }

        if (res.status === 202) {
           event.res.status = 202;
           event.res.statusText = "OK"; 
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

      deleteCookie(event, 'session', {domain: domain, path: '/'})
      deleteCookie(event, 'iat', {domain: domain, path: '/'})
      rawSetCookie.forEach(line => event.res.headers.append('Set-Cookie', line));

      const sessionLine = rawSetCookie.find(c => c.trim().startsWith('session=')) ?? '';
      const sessionValue = sessionLine.split(';', 1)[0].split('=')[1] || refresh;
      refresh = sessionValue; 

      makeCookie(event, '__Secure-a', newToken, {
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

        event.context.session = refresh;
        event.context.accessToken = newToken; 
       } catch(err) {
         if (err instanceof HTTPError) throw err;
         throwError(log, event, 'SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', `Unexpected error type. ${err}`);
       }
    }

  if (!currentToken) {
        log.info('No access token; rotating both tokens');
        return await rotateBoth();
  }

    try {
        const meta = await getMetadata(log, false, currentToken, refresh, canary, event);
        
        if ("serverError" in meta && meta.serverError) {
            log.info('Meta resolved with an error; rotating both tokens');
            cache.del(currentToken);
            return await rotateBoth();
        }

        if ("mfa" in meta && meta.mfa) {
           event.res.status = 202;
           event.res.statusText = "OK"; 
           return {
            text: 'MFA required'
           }
        }

        if ("authorized" in meta && !meta.authorized) {
            log.info('Meta not authorized; rotating both tokens');
            cache.del(currentToken);
            return await rotateBoth();
        }

        if ("shouldRotate" in meta && meta.shouldRotate) {
            log.info({ msUntilExp: meta.msUntilExp }, 'Meta suggests rotation; rotating both tokens');
            cache.del(currentToken);
            return await rotateBoth();
        }
        event.context.session = refresh;
        event.context.accessToken = currentToken;
    }  catch (err) {
        log.warn({ err }, 'Meta check failed; rotating both tokens');
        cache.del(currentToken);
        return await rotateBoth();
    }
  }
