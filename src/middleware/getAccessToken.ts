import { makeCookie } from '../utils/cookieGenerator.js'
import { sendToServer } from '../utils/serverToServer.js'
import { getLogger } from '../utils/logger.js';
import { getCookie, H3Event, HTTPError, parseCookies, setResponseStatus } from 'h3';
import throwError from './error.js';
import { getConfiguration } from '../config/config.js';

declare module 'h3' {
  interface Request {
    accessToken?: string;
  }
}

export async function ensureAccessToken(event: H3Event) {
  let token = getCookie(event, '__Secure-a');
  const canary = getCookie(event, 'canary_id');
  const accessIat = Number(getCookie(event, 'a-iat'));
  const log = getLogger().child({service: 'auth', branch: `access_tokens`, reqID: event.context.rid })
  const config = getConfiguration();
  
  const REFRESH_THRESHOLD = 5 * 60 * 1000;
  const TTL_MS     = 1000 * 60 * 15; 
  const expiresAt   = (accessIat + TTL_MS);
  const msUntilExp  = expiresAt - Date.now();

  if (!token || msUntilExp <= REFRESH_THRESHOLD) {
    const refresh = getCookie(event, 'session');  
    log.info('No access token found Generating a new one')

  if (!refresh || !canary) {
    throwError(log, event, 'AUTH_REQUIRED', 401, 'Unauthorized','Re-authentication required', 'No refresh token is found Re-authentication required.');
   }

   const cookies = [
        {
          label: `canary_id`,
          value: canary
        },
        {
          label: `session`,
          value: refresh
        },
      ]
      try {
    log.info('Sending Request To api...')
    const resp = await sendToServer(false, '/auth/refresh-access', 'POST', event, false, cookies)
        if (!resp) {
        throwError(log, event, 'SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', 'Api Call Failed');
    };

    const json: any  = await resp.json();


    if (resp.status === 202) {
       log.info({code : resp.status, ServerResponse: json}, '2MFA is required')
       event.res.status = 202
       event.res.statusText = "2MFA is required";
    }

    if (resp.status !== 200) {
      throwError(log, event, 'AUTH_REQUIRED', 401, 'Unauthorized',`${json.error + resp.status}`, `${json}`);
    } 
 
    token = json.accessToken;
    const accessIat = json.accessIat;

    if (!token) {
      throwError(log, event, 'SERVER_ERROR', 500, 'NO TOKEN',`Server Error please try again later`, `Server didn't send a token!`);
    }

    makeCookie(event, 'a-iat', accessIat, {
      httpOnly: true,
      secure:   true,
      sameSite: 'strict',
      path:     '/',
      domain:   config.domain,
      maxAge:   16 * 60 * 1000
    });
    makeCookie(event, '__Secure-a', token, {
      httpOnly: true,
      secure:   true,
      sameSite: 'strict',
      path:     '/',
      domain:   config.domain,
      maxAge:   16 * 60 * 1000
    });
    log.info({server: json , code : resp.status}, 'success')
    } catch(err) {
      throwError(log, event, 'SERVER_ERROR', 500, 'Server Error',`Server Error please try again later`, `Error getting new access token`);
    }
  }
  event.context.accessToken = token; 
}