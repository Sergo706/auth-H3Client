import {  appendHeader, defineEventHandler, getCookie, setResponseStatus } from "h3";
import type { EventHandler, EventHandlerRequest } from 'h3';
import { ensureValidCredentials,hmacSignatureMiddleware, throwHttpError, getLogger } from "../main.js";
import { getCachedUserData } from "./getCachedUserData.js";
import type { Cookies } from "@internal/shared";
import { getConfiguration } from "@internal/shared";

export interface MfaResponse { mfaRequired: string; message: string };

/**
 * Wraps an H3 event handler with strict authentication enforcement.
 * Validates tokens, rotates credentials if needed, and populates `event.context.authorizedData`.
 * Throws 401 if the user is not authenticated.
 * 
 * @template T - The event handler request type.
 * @template D - The expected return type of the handler.
 * @param handler - The H3 event handler to wrap.
 * @returns A wrapped handler that requires authentication.
 * 
 * @example
 * // server/api/private.get.ts
 * import { defineAuthenticatedEventHandler } from 'auth-h3client';
 * 
 * export default defineAuthenticatedEventHandler((event) => {
 *   const user = event.context.authorizedData;
 *   return { message: `Hello, ${user.userId}` };
 * });
 */
export const defineAuthenticatedEventHandler = <T extends EventHandlerRequest, D>(handler: EventHandler<T, D>): EventHandler<T, Promise<D | MfaResponse>>  => { 

    return defineEventHandler<T, Promise<D | MfaResponse>>(async (event) => { 
         const { uStorage } = getConfiguration()
         hmacSignatureMiddleware(event);
         const value = await ensureValidCredentials(event);

         if (value) return value as D;
             const token = event.context.accessToken;
             const refreshToken = event.context.session;
             const canary = getCookie(event, 'canary_id');
             const log = getLogger().child({service: 'auth-client', type: 'dataAccess'});

            if (!token || !refreshToken || !canary) {
                throwHttpError(log,event,'FORBIDDEN',401, "UnAuthorized", "Un Authorized",`user is not authorized to access this resources. 
                    No Access or refreshToken provided`);
            }

        const cookies: Cookies[] = [
            { label: 'session', value: refreshToken  },
            { label: 'canary_id', value: canary }
        ];

        const result = await getCachedUserData(event, cookies, token, uStorage.storage, uStorage.cacheOptions);
        if (result.type === 'ERROR') {
            if (result.reason === 'SERVER_ERROR') {
                throwHttpError(log,event,'SERVER_ERROR',500,'Server error','',);
            }

            if (result.status === 429) {
                appendHeader(event, 'Retry-After', result.retryAfter);
                throwHttpError(log,event,'FORBIDDEN',429,'To many requests','To many requests, please try again later');
            }

            if (result.status === 202) {
                setResponseStatus(event, 202, "OK");
                return {
                    mfaRequired: 'MFA required',
                    message: result.msg
                };
            }
            if (result.reason === 'DETAILED_SERVER_ERROR') {
                throwHttpError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again');
            }
            if (result.reason === 'UNAUTHORIZED' && result.status === 401) {
                throwHttpError(log,event,'FORBIDDEN',401, "UNAUTHORIZED", "UnAuthorized");
            }

            throwHttpError(log, event, 'AUTH_CLIENT_ERROR', result.status, result.reason);
    }
        event.context.authorizedData = result.data;
        return handler(event);
    })
}