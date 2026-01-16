import { ensureValidCredentials,hmacSignatureMiddleware, throwHttpError, getLogger } from '../main.js';
import { getCachedUserData } from './getCachedUserData.js';
import { getCookie, HTTPError, type EventHandler, type EventHandlerRequest } from 'h3';
import { defineHandler } from 'h3';
import type { Storage } from 'unstorage';
import { CacheOptions } from '@internal/shared';

interface AuthOptions {
  storage: Storage;
  cache?: CacheOptions; 
}

export const defineOptionalAuthenticationEvent = <T extends EventHandlerRequest, D>(handler: EventHandler<T, D>, options: AuthOptions): EventHandler<T, Promise<D>>  => {
  return defineHandler<T, Promise<D>>(async (event) => {
      const log = getLogger().child({service: 'auth', type: 'optional-auth'});
    try {

    hmacSignatureMiddleware(event);
    const interruption = await ensureValidCredentials(event);

    if (interruption) {
        throw new Error(`Credential interruption returned, ${JSON.stringify(interruption)}`);
    }

    const token = event.context.accessToken;
    const refreshToken = event.context.session;
    const canary = getCookie(event, 'canary_id');


    if (!token || !refreshToken || !canary) {
        event.context.authorizedData = undefined;
        throw new Error('No tokens');
    }

        const cookies = [{
        label: 'session',
        value: refreshToken
    },
 {
        label: 'canary_id',
        value: canary
 }
];

 const result = await getCachedUserData(event, cookies, token, options.storage);

    if (result.type === 'ERROR') {
        if (result.status === 429) {
            event.res.headers.append('Retry-After', String(result.retryAfter))
            throwHttpError(log, event, 'FORBIDDEN', 429, 'To many requests', 'To many requests, please try again later');
        }

        if (result.reason === 'SERVER_ERROR') {
            throw new Error('Auth Service Unreachable');
        }
        if (result.reason === 'MFA') {
             throw new Error(`MFA required ${String(result.status)}`);
        }
        if (result.reason === 'UNAUTHORIZED') {
            throw new Error(`Role mismatch or UnAuthorized`);
        }

        if (result.reason === 'DETAILED_SERVER_ERROR') {
            throw new Error(`Auth Service declined: ${String(result.status)}`);
        }
        throw new Error(`Auth Service error: ${result.reason}`);
    }

      event.context.authorizedData = result.data;
    } catch (err) {
        if (err instanceof HTTPError && err.status === 429) {
            throw err;
        }
        log.info({...err as object},'Optional auth failed, proceeding as guest');
        event.context.authorizedData = undefined;
    }
    return handler(event);
  });
};