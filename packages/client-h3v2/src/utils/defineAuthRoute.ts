import {  defineHandler, getCookie } from "h3";
import type { EventHandler, EventHandlerRequest } from 'h3';
import { ensureValidCredentials,hmacSignatureMiddleware, throwHttpError, getLogger } from "../main.js";
import { getCachedUserData } from "./getCachedUserData.js";
import type { Storage } from 'unstorage';
import type { Cookies } from '../types/Cookies.js';
import { CacheOptions } from "../types/CachedAuthResponse.js";

export interface MfaResponse { mfaRequired: string; message: string };

interface AuthOptions {
  storage: Storage;
  cache?: CacheOptions; 
}

export const defineAuthenticatedEventHandler = <T extends EventHandlerRequest, D>(handler: EventHandler<T, D>, options: AuthOptions): EventHandler<T, Promise<D | MfaResponse>>  => { 

    return defineHandler<T, Promise<D | MfaResponse>>(async (event) => { 
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
            { label: 'session', value: refreshToken },
            { label: 'canary_id', value: canary }
        ];

        const result = await getCachedUserData(event, cookies, token, options.storage);
        if (result.type === 'ERROR') {
            if (result.reason === 'SERVER_ERROR') {
                throwHttpError(log,event,'SERVER_ERROR',500,'Server error','',);
            }

            if (result.status === 429) {
                event.res.headers.append('Retry-After', String(result.retryAfter))
                throwHttpError(log,event,'FORBIDDEN',429,'To many requests','To many requests, please try again later');
            }

            if (result.status === 202) {
                event.res.status = 202;
                event.res.statusText = 'OK'
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