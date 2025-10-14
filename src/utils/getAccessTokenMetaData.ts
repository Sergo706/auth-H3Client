import {sendToServer} from "./serverToServer.js"
import pino from 'pino';
import { H3Event } from 'h3';
import { MiniCache } from "./miniCache.js";
import type { ServerAccessTokenMetaData } from "../types/ServerMetaData.js";

 export const cache = new MiniCache(200)

 type ErrorReason = {mfa?: boolean, userNotFound?: boolean, unAuthorized?: boolean, serverError?: boolean} 

 export async function getMetadata(log: pino.Logger, getFresh: boolean, accessToken: string, refreshToken: string, canary: string, event: H3Event): Promise<ServerAccessTokenMetaData | ErrorReason> {
    log.info(`Getting metadata...`)

    const exists = cache.get(accessToken) as (ServerAccessTokenMetaData) | undefined;

    if (exists && !getFresh) {
        log.info(`This meta already cached, returning cached data.`)
        return exists;
    }

    const token = accessToken;
    const cookies = [
        {label: 'session', value: refreshToken},
        {label: 'canary_id',value: canary}
    ];

    log.info(`Getting new metadata...`)
    try {
        const response = await sendToServer(false, '/secret/accesstoken/metadata', 'GET', event, false, cookies, {}, token)

        if (!response) {
            log.error('Error getting meta data.')
            return {serverError: true};
        }

        if (response.status === 401) {
            log.error('Error getting meta data. invalid credentials')
            return {unAuthorized: true};
        }

       if (response.status === 404) {
            log.error('Error getting meta data. no such user')
            return {userNotFound: true};``
        }

        if (response.status === 202) {
            log.error('Error getting meta data. MFA required')
            return {mfa: true};
        }

        if (!response.ok || response.status !== 200) {
            log.error('Error getting meta data. Unexpected error type')
            return {serverError: true};
        }

        const json = await response.json() as ServerAccessTokenMetaData;

        const ttl = Math.max(0, json.msUntilExp - json.refreshThreshold - 5000);
        if (ttl > 0) cache.set(accessToken, json , ttl);
        return  json;

    } catch(err) {
        log.error({err},'Error getting meta')
        return {serverError: true};
    }
}