import { H3Event } from "h3";
import type { RemoteConfig } from "../types/configSchema.js";
import { sendToServer } from "./serverToServer.js";
import { parseResponseContentType } from "./checkResponseType.js";
import { getLogger } from "./logger.js";
import { sharedSettings } from "../types/configSchema.js";
import z, { ZodError } from "zod";
import { MiniCache } from "./miniCache.js";
import { getConfiguration } from "../config/config.js";
const cache = new MiniCache<RemoteConfig>(100)

export async function getOperationalConfig(event: H3Event): Promise<RemoteConfig> {
    const log = getLogger().child({service: 'utils', type: '/operational/config'})
    const config = getConfiguration()
    const serverKey = `${config.server.auth_location.serverOrDNS}:${config.server.auth_location.port}`
    const exists = cache.get(serverKey)

    if (exists) return exists;

    try {

        const res = await sendToServer(false, '/operational/config', 'GET', event, false);
        if (!res) {
           throw new Error('Cannot get /operational/config');
        }

        const json = await parseResponseContentType(log, res) as Promise<RemoteConfig>;
        if (!json) {
            throw new Error('Cannot get /operational/config. error parsing response');
        }

      
        const results = sharedSettings.parse(json);

        const finalPayload: RemoteConfig = {
            domain: results.domain,
            accessTokenTTL: Math.floor(results.accessTokenTTL / 1000),
        };

        cache.set(serverKey, finalPayload, 1000 * 60 * 60 * 24);
        return finalPayload;
        
    } catch(err) {
        if (err instanceof ZodError) {
           throw new Error (z.prettifyError(err))
        } else {
            throw err;
        }
    }
}