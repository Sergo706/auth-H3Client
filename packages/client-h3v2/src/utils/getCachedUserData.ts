import type { ServerResponse } from '@internal/shared';
import type {  H3Event } from 'h3';
import { sendToServer as serviceToService} from "./serverToServer.js";
import { getLogger, parseResponseContentType } from "@internal/shared";
import { createHash } from 'node:crypto';
import type { Storage } from 'unstorage';
import type { CachedAuthResponse, CacheOptions } from '@internal/shared';
import type { Cookies } from '@internal/shared';

/**
 * Retrieves and caches user authentication data from the auth service.
 * Uses a SHA256 hash of tokens as cache key. Returns cached data if available,
 * otherwise fetches from the auth server and caches the result.
 * 
 * @param event - The H3 event object.
 * @param cookies - Array of cookies to forward to the auth service.
 * @param token - The access token for authorization.
 * @param storage - Unstorage instance for caching.
 * @param cacheOptions - Optional TTL configuration for cache entries.
 * @returns Cached auth response (success with user data or error details).
 * 
 * @example
 * const result = await getCachedUserData(event, cookies, token, storage);
 * if (result.type === 'SUCCESS') {
 *   console.log(result.data.userId);
 * }
 */
export const getCachedUserData = async (event: H3Event, cookies: Cookies[], token: string, storage: Storage, cacheOptions?: CacheOptions): Promise<CachedAuthResponse> => {
     const log = getLogger().child({service: 'auth', type: 'dataAccess-cache'});
     const canary = cookies.find(c => c.label === 'canary_id')?.value;
     const refreshToken = cookies.find(ref => ref.label === 'session')?.value;
     const key = `auth:user:${canary ?? ''}:${refreshToken ?? ''}:${token}`;
     const hashedKey = `auth:user:${createHash('sha256').update(key).digest('hex')}`;
     const successTtl = cacheOptions?.successTtl ?? 60 * 60 * 24 * 30; 
     const rateLimitTtl = cacheOptions?.rateLimitTtl ?? 10;

     const cached = await storage.getItem<CachedAuthResponse>(hashedKey);

     if (cached) {
        return cached;
     }

     const res = await serviceToService(false, '/secret/data', 'GET', event, false, cookies, {}, token);

     if (!res) {
        log.error('Server responded with null');
        return {
            type: 'ERROR',
            status: 500,
            reason: 'SERVER_ERROR',
            msg: 'Auth server error'
        };
     }
     
     const json = await parseResponseContentType(log, res) as ServerResponse;
       if (res.status === 429) {
              log.warn(`User rate limited`);  
              const retrySec = res.headers.get('Retry-After');
     
              const errorResponse: CachedAuthResponse = {
                type: 'ERROR',
                status: 429,
                reason: 'RATE_LIMIT',
                msg: retrySec ??  'To many attempts',
                retryAfter: retrySec ? parseInt(retrySec) : undefined
              };
                await storage.setItem(hashedKey, errorResponse, { ttl: retrySec ?? rateLimitTtl });
                return errorResponse;
             };
     
       if (res.status === 202) {
            log.warn(json.message ?? json.error ?? 'MFA required');  
            return {
                type: 'ERROR',
                status: 202,
                reason: 'MFA',
                msg: json.message ?? json.error ?? 'MFA required'
             };
         } 

        if (res.status === 500 || !res.ok || res.status !== 200) {
                log.error(`Api Call Failed \n ${String(json.error)}`);  
                return {
                    type: 'ERROR',
                    status: res.status !== 500 ? res.status : 500,
                    reason: 'DETAILED_SERVER_ERROR',
                    msg: `Api Call Failed \n ${String(json.error)}`
                };
             }
         
        if (!json.authorized || !json.roles) {
                log.warn(`user is not authorized to access this resources. \n
                    server declined: ${String(json.error)}`);  
                return {
                    type: 'ERROR',
                    status: 401,
                    reason: 'UNAUTHORIZED',
                    msg: `user is not authorized to access this resources. \n
                    server declined: ${String(json.error)}`
                };
        };

        await storage.setItem<CachedAuthResponse>(hashedKey, {
            type: 'SUCCESS',
            data: json
        }, { ttl: successTtl });

        return {
            type: 'SUCCESS',
            data: json
        };
};

