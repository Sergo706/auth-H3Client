import { ensureValidCredentials } from "../middleware/rotateTokens.js";
import hmacSignatureMiddleware from "../middleware/signatureMiddleware.js";
import throwHttpError from "../middleware/error.js";
import { getLogger } from "@internal/shared";
import { getCachedUserData } from './getCachedUserData.js';
import { appendHeader, getCookie, H3Error, type EventHandler, type EventHandlerRequest } from 'h3';
import { defineEventHandler } from 'h3';
import { getConfiguration } from "@internal/shared";

/**
 * Wraps an H3 event handler with optional authentication.
 * Attempts to authenticate the user but proceeds as guest if authentication fails.
 * Sets `event.context.authorizedData` to user data or `undefined` for guests.
 * 
 * @template T - The event handler request type.
 * @template D - The expected return type of the handler.
 * @param handler - The H3 event handler to wrap.
 * @returns A wrapped handler that works for both authenticated users and guests.
 * 
 * @example
 * // server/api/posts/[id].get.ts
 * import { defineOptionalAuthenticationEvent } from 'auth-h3client';
 * 
 * export default defineOptionalAuthenticationEvent((event) => {
 *   const user = event.context.authorizedData; // may be undefined
 *   return { isLoggedIn: !!user };
 * });
 */
export const defineOptionalAuthenticationEvent = <T extends EventHandlerRequest, D>(handler: EventHandler<T, D>): EventHandler<T, Promise<D>>  => {
  return defineEventHandler<T, Promise<D>>(async (event) => {
      const log = getLogger().child({service: 'auth', type: 'optional-auth'});
      const { uStorage } = getConfiguration()
    try {

    hmacSignatureMiddleware(event);
    const interruption = await ensureValidCredentials(event);
    const rotated = event.context.isRotated;

    if (interruption && !rotated) {
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

    const result = await getCachedUserData(event, cookies, token, uStorage.storage, uStorage.cacheOptions);

    if (result.type === 'ERROR') {
        if (result.status === 429) {
            appendHeader(event, 'Retry-After', result.retryAfter);
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
        if (err instanceof H3Error && err.statusCode === 429) {
            throw err;
        }
        log.info({...err as object},'Optional auth failed, proceeding as guest');
        event.context.authorizedData = undefined;
    }
    return handler(event);
  });
};