import { sendToServer } from '../utils/serverToServer.js'
import { getLogger } from "../utils/logger.js";
import { deleteCookie, getCookie, H3Event, HTTPError } from 'h3';
import throwError from './error.js';
import { parseResponseContentType } from '../utils/checkResponseType.js';
import { getOperationalConfig } from '../utils/getRemoteConfig.js';
import { getMetadata } from '../utils/getRefreshTokenMetaData.js';
import { cache } from '../utils/getRefreshTokenMetaData.js';

/**
 * Validates and refreshes the session cookie when required, coordinating with the auth server
 * and cache to keep refresh tokens current.
 *
 * @param event - H3 event for the incoming request.
 * @returns A JSON payload describing MFA requirements, or void when the session remains valid.
 *
 * @example
 * await ensureRefreshCookie(event);
 */
export async function ensureRefreshCookie(event: H3Event) { 

  let refresh = getCookie(event, 'session');
  const canary = getCookie(event, 'canary_id');
  const { domain} = await getOperationalConfig(event)

  const iat = Number(getCookie(event, 'iat')); 


const log = getLogger().child({service: 'auth', branch: `refresh_tokens`, reqID: event.context.rid })

 if (!refresh || !canary) {
   throwError(log, event, 'AUTH_REQUIRED', 401, 'Unauthorized','Re-authentication required', 'Refresh Tokens or canary id not founded. Login required');
 }

const rotate = async () => {
    log.info(`rotating refresh tokens...`)
    const cookies = [
    {label: 'canary_id', value: canary},
    {label: 'session', value: refresh}
]

 try {
    log.info('Sending Request To api...')
    const res = await sendToServer(false, `/auth/user/refresh-session`, 'POST', event, false, cookies);

    if (!res) {
      throwError(log, event, 'SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', 'Api Call Failed');
    };

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

   if (res.status === 200) {
      log.info({session: json.session},'Verified refresh token. rotation is not needed.')
      event.res.status = 200;
      event.res.statusText = "OK"; 
      return;
   }

    if (res.status === 500 || !res.ok || res.status !== 201) {
         throwError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', 
                     `Api Call Failed with Unexpected results. \n ${json.error}`);
    }

    const rawSetCookie = res.headers.getSetCookie() || []; 
    const answer = json.session ?? json.error;

     if (rawSetCookie.length === 0) {
        throwError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', `New refresh token and related cookies ended up null. ${answer}`);
    }
    
    deleteCookie(event, 'session', {domain: domain, path: '/'})
    deleteCookie(event, 'iat', {domain: domain, path: '/'})
    rawSetCookie.forEach(line => event.res.headers.append('Set-Cookie', line));

    const sessionLine = rawSetCookie.find(c => c.trim().startsWith('session=')) ?? '';
    const sessionValue = sessionLine.split(';', 1)[0].split('=')[1] || refresh;
    refresh = sessionValue; 
    
    
    event.context.session = refresh;
 } catch(err) {
    if (err instanceof HTTPError) throw err;
    throwError(log, event, 'SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', `Unexpected error type. ${err}`);
}
 }


 try {
    const meta = await getMetadata(log, false, refresh,canary,iat,event);

     if ("authorized" in meta && !meta.authorized) {
         log.warn('Meta not authorized; re login required');
         cache.del(refresh);
         throwError(log, event, 'AUTH_REQUIRED', 401, 'Unauthorized','Re-authentication required', 'Refresh Tokens or canary id not founded. Login required');
     }

     if ("serverError" in meta && meta.serverError) {
        log.error('Meta resolved with an error; re login required');
        cache.del(refresh);
        throwError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Server Error', 'Meta not authorized; re login required');
     }

     if ("shouldRotate" in meta && meta.shouldRotate) {
        log.info({ msUntilExp: meta.msUntilExp }, 'Meta suggests rotation; rotating refresh token');
        cache.del(refresh);
        return await rotate();
     }
     
    event.context.session = refresh;
 }  catch (err) {
         log.error({ err }, 'Meta check failed; rotating both tokens');
         cache.del(refresh);
         throwError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Server Error', 'Meta not authorized; re login required');
    }

}
