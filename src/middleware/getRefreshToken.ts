import { sendToServer } from '../utils/serverToServer.js'
import { getLogger } from "../utils/logger.js";
import { getCookie, H3Event, HTTPError } from 'h3';
import throwError from './error.js';

declare module 'h3' {
  interface Request {
    session?: string;
  }
}

export async function ensureRefreshCookie(event: H3Event) {

  let refresh = getCookie(event, 'session');
  const canary = getCookie(event, 'canary_id');

  const iat = Number(getCookie(event, 'iat')); 
  const cookies = [
        {
      label: 'canary_id',
      value: canary
    },
    {
    label: 'session',
    value: refresh  
  }
]
const log = getLogger().child({service: 'auth', branch: `refresh_tokens`, reqID: event.context.rid })

 if (!refresh || !canary) {
   throwError(log, event, 'AUTH_REQUIRED', 401, 'Unauthorized','Re-authentication required', 'Refresh Tokens or canary id not founded. Login required');
 }

  const REFRESH_THRESHOLD = 5 * 60 * 1000;
  const TTL_MS     = 1000 * 60 * 60 * 24 * 3; 
  const expiresAt   = (iat + TTL_MS);
  const msUntilExp  = expiresAt - Date.now();

  if (msUntilExp <= REFRESH_THRESHOLD) {
    try { 
    const resp = await sendToServer(false, `/auth/user/refresh-session`, 'POST', event, false, cookies)
        if (!resp) {
        throwError(log, event, 'SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', 'Api Call Failed');
    };
    const json = await resp.json();
    if (resp.status === 201 || resp.status === 200) {
      const rawSetCookie = resp.headers.getSetCookie();    
      log.info({code: resp.status}, 'Verified refresh token')
      if (rawSetCookie.length > 0) {
        log.info('setting new refresh token')
        rawSetCookie.forEach(line => event.res.headers.append('Set-Cookie', line));
        log.info('done')
        const line = rawSetCookie.find(c => c.trim().startsWith('session='))?.split(';', 1)[0]?? ''; 
        refresh = line ?? refresh; 
       return;
     }
     
    } 

    if (resp.status === 202) {
       log.info({code : resp.status, ServerResponse: json}, '2MFA is required')
       event.res.status = 202
       event.res.statusText = "2MFA is required";
    }
    if (resp.status === 500) {
        throwError(log, event, 'SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', 
          `${json}, API / Server Error`);
    }

      if (resp.status === 401) {
        throwError(log, event, 'AUTH_REQUIRED', 401, 'Unauthorized','Re-authentication required', `Login required ${json}`);
    } 

     } catch(err) {
      throwError(log, event, 'SERVER_ERROR', 500, 'Server Error',`Server Error please try again later`, `Error getting new refresh token`);
    }
  }
  event.context.session = refresh; 
  return;
}
