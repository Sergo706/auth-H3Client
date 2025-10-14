import {sendToServer} from "./serverToServer.js"
import pino from 'pino';
import { H3Event } from 'h3';
import { MiniCache } from "./miniCache.js";
import type { ServerRefreshTokenMetaData } from "../types/ServerMetaData.js";

 export const cache = new MiniCache(200)

 type ErrorReason = { unAuthorized?: boolean, serverError?: boolean, } 

 export async function getMetadata(log: pino.Logger, getFresh: boolean, refreshToken: string, canary: string, iatCookie: number, event: H3Event): Promise<ServerRefreshTokenMetaData | ErrorReason> {
    log.info(`Getting metadata...`)

    const exists = cache.get(refreshToken) as (ServerRefreshTokenMetaData) | undefined;

    if (exists && !getFresh) {
        log.info(`This meta already cached, returning cached data.`)
        return exists;
    }

    const token = refreshToken;
    const cookies = [
        {label: 'session', value: refreshToken},
        {label: 'canary_id',value: canary},
        {label: 'iat', value: iatCookie}
    ];

    log.info(`Getting new metadata...`)
    try {
        const response = await sendToServer(false, '/secret/refreshtoken/metadata', 'GET', event, false, cookies, {})

        if (!response) {
            log.error('Error getting meta data.')
            return {serverError: true};
        }

        if (response.status === 401) {
            log.error('Error getting meta data. invalid credentials')
            return {unAuthorized: true};
        }

        if (!response.ok || response.status === 500 || response.status !== 200) {
            log.error('Error getting meta data. Unexpected error type')
            return {serverError: true};
        }

        const json = await response.json() as ServerRefreshTokenMetaData;

        const ttl = Math.max(0, json.msUntilExp - json.refreshThreshold - 5000);
        if (ttl > 0) cache.set(token, json , ttl);
        return json;

    } catch(err) {
        log.error({err},'Error getting meta')
        return {serverError: true};
    }
}