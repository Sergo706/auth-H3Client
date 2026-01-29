import { sendToServer } from '../utils/serverToServer.js'
import { getLogger, safeAction, type AccessRotationResult } from "@internal/shared";
import { appendHeader, getCookie, H3Event, setResponseStatus , H3Error} from 'h3';
import throwError from './error.js';
import { parseResponseContentType } from "@internal/shared";
import { getMetadata } from '../utils/getAccessTokenMetaData.js';
import { cache } from "../utils/getAccessTokenMetaData.js";
import { getOperationalConfig } from '../utils/getRemoteConfig.js';
import { applyRotationResult } from '../utils/applyRotationResults.js';

declare module 'h3' {
  interface Request {
    accessToken?: string;
  }
}

/**
 * Guarantees that a valid access token exists for the request, rotating tokens via the auth
 * server when necessary and caching rotation results.
 *
 * @param event - H3 event containing the current request context.
 * @returns A JSON payload describing MFA or rotation results, or void on success.
 *
 * @example
 * await ensureAccessToken(event);
 */
export async function ensureAccessToken(event: H3Event) {
  const log = getLogger().child({service: 'auth', branch: `access_tokens_rotations`, reqID: event.context.rid })
  const { domain, accessTokenTTL } = await getOperationalConfig(event)

  const currentToken = getCookie(event, '__Secure-a');
  const canary = getCookie(event, 'canary_id');
  const refresh = getCookie(event, 'session');  

  if (!refresh || !canary) {
    throwError(log, event, 'AUTH_REQUIRED', 401, 'Unauthorized','Re-authentication required', 'No refresh token is found Re-authentication required.');
   }

 const rotate = async (): Promise<AccessRotationResult> => {
    log.info('No access token found. Generating a new token')
     const cookies = [
        {label: `canary_id`,  value: canary},
        {label: `session`, value: refresh},
      ]    

       try {
          log.info('Sending Request To api...')
          const res = await sendToServer(false, '/auth/refresh-access', 'POST', event, false, cookies)
            
          if (!res) {
            throwError(log, event, 'SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', 'Api Call Failed');
          }
          const json = await parseResponseContentType(log, res);

        if (res.status === 429) {
            log.warn(`User rate limited`);  
            const retrySec = res.headers.get('Retry-After');
            if (retrySec) {
                appendHeader(event, 'Retry-After', (retrySec as unknown as number))
            }
            setResponseStatus(event, 429)
            return {error: `Too many attempts, please try again later.`};
        }

        if (res.status === 401) {
          throwError(log, event, 'AUTH_REQUIRED', 401, 'Unauthorized','Re-authentication required', `Re-authentication required. \n ${json.message} \n ${json.error}`);
        }

        if (res.status === 202) {
           setResponseStatus(event, 202, 'OK')
           return {
            text: 'MFA required',
            message: json.message
           }
        }

        if (res.status === 500 || !res.ok || res.status !== 200) {
            throwError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', 
                `Api Call Failed \n ${json.error}`);
        }

        const newToken = json.accessToken as string;
        const accessIat = json.accessIat as string;

        if (!accessIat || !newToken) {
          throwError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', `New access token and related cookies ended up null`);
        }

        return { type: 'access', newToken, accessIat };
       } catch(err) {
         if (err instanceof H3Error) throw err;
         throwError(log, event, 'SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', `Unexpected error type. ${err}`);
       }
    }

    const rotateAndApply = async () => {
        const result = await safeAction(refresh, rotate);
        return applyRotationResult(event, result, domain, accessTokenTTL);
    };

  if (!currentToken) {
        log.info('No access token; rotating access token');
        return await rotateAndApply();
   }

      try {
           const meta = await safeAction(refresh, () => getMetadata(log, false, currentToken, refresh, canary, event))
           if ("serverError" in meta && meta.serverError) {
               log.info('Meta resolved with an error; rotating access token');
               cache.del(currentToken);
               return await rotateAndApply();
           }
   
           if ("mfa" in meta && meta.mfa) {
              setResponseStatus(event, 202, 'OK')
              return {
               text: 'MFA required'
              }
           }
   
           if ("authorized" in meta && !meta.authorized) {
               log.info('Meta not authorized; rotating access token');
               cache.del(currentToken);
               return await rotateAndApply();
           }
   
           if ("shouldRotate" in meta && meta.shouldRotate) {
               log.info({ msUntilExp: meta.msUntilExp }, 'Meta suggests rotation; rotating access token');
               cache.del(currentToken);
               return await rotateAndApply();
           }

           event.context.accessToken = currentToken;
       }  catch (err) {
           log.warn({ err }, 'Meta check failed; rotating access token');
           cache.del(currentToken);
           return await rotateAndApply();
       }
}

