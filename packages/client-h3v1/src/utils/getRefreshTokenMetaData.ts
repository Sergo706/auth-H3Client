import {sendToServer} from "./serverToServer.js"
import pino from 'pino';
import { H3Event } from 'h3';
import { MiniCache } from "@internal/shared";
import type { ServerRefreshTokenMetaData } from "@internal/shared";
 export const cache = new MiniCache(200)

 type ErrorReason = { unAuthorized?: boolean, serverError?: boolean, } 

/**
 * Retrieves refresh-token metadata, caching results and mapping failures to structured flags.
 *
 * @param log - Scoped Pino logger.
 * @param getFresh - Indicates whether to bypass cached data.
 * @param refreshToken - Refresh token whose metadata should be validated.
 * @param canary - Canary cookie associated with the session.
 * @param iatCookie - Issued-at cookie for the refresh token.
 * @param event - H3 event providing request context.
 * @returns Token metadata or an error descriptor.
 *
 * @example
 * const meta = await getMetadata(log, false, refreshToken, canary, iat, event);
 */
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
