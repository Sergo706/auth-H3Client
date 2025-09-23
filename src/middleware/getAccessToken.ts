import { makeCookie } from '../utils/cookieGenerator.js'
import { sendToServer } from '../utils/serverToServer.js'
import { getLogger } from '../utils/logger.js';
import { getCookie, H3Event, HTTPError, parseCookies, setResponseStatus } from 'h3';


export async function ensureAccessToken(event: H3Event) {
  let token = getCookie(event, '__Secure-a');
  const canary = getCookie(event, 'canary_id');
  const accessIat = Number(getCookie(event, 'a-iat'));
  const log = getLogger().child({service: 'auth', branch: `access_tokens`, reqID: event.context.rid })
  
  const REFRESH_THRESHOLD = 5 * 60 * 1000;
  const TTL_MS     = 1000 * 60 * 15; 
  const expiresAt   = (accessIat + TTL_MS);
  const msUntilExp  = expiresAt - Date.now();

  if (!token || msUntilExp <= REFRESH_THRESHOLD) {
    const refresh = getCookie(event, 'session');  
    log.info('No access token found Generating a new one')

  if (!refresh || !canary) {
   log.warn('No refresh token is found Re-authentication required.')
   throw new HTTPError({
    body: { date: new Date().toJSON(), code: 'AUTH_REQUIRED' },
    status: 401,
    statusText: 'Unauthorized',
    message: 'Re-authentication required'
   })
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
        log.error('Api Call Failed')
        throw new HTTPError({
            body: { date: new Date().toJSON(), code: 'SERVER_ERROR' },
            status: 500,
            statusText: 'Server Error',
            message: 'Something went wrong, please try restarting the page, and try again.' ,
        })
    };

    const json: any  = await resp.json();


    if (resp.status === 202) {
       log.info({code : resp.status, ServerResponse: json}, '2MFA is required')
       event.res.status = 202
       event.res.statusText = "2MFA is required";
    }

    if (resp.status !== 200) {
      log.warn({code : resp.status, ServerErrorMsg: json.error, ServerResponse: json},'error code')
      throw new HTTPError({
        body: { date: new Date().toJSON(), code: 'AUTH_REQUIRED' },
        status: 401,
        statusText: json.error + resp.status,
        message: json
      })
    } 
 
    token = json.accessToken;
    const accessIat = json.accessIat;

    if (!token) {
      log.error(`Server didn't send a token!`)
        throw new HTTPError({
            body: { date: new Date().toJSON(), code: 'SERVER_ERROR' },
            status: 500,
            statusText: 'NO TOKEN',
            message: 'Server Error please try again later.'
        })
    }

    makeCookie(event, 'a-iat', accessIat, {
      httpOnly: true,
      secure:   true,
      sameSite: 'strict',
      path:     '/',
      domain:   'riavzon.com',
      maxAge:   16 * 60 * 1000
    });
    makeCookie(event, '__Secure-a', token, {
      httpOnly: true,
      secure:   true,
      sameSite: 'strict',
      path:     '/',
      domain:   'riavzon.com',
      maxAge:   16 * 60 * 1000
    });
    log.info({server: json , code : resp.status}, 'success')
    } catch(err) {
       throw new HTTPError({
        body:  { date: new Date().toJSON(), code: 'SERVER_ERROR' },
        status: 500,
        statusText: 'Server Error',
        message: 'Server Error please try again later.'
       }) 
    }
  }
  event.req.context!.accessToken = token; 
}