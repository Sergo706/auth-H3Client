import pino from "pino";
import { getConfiguration } from "../config/config.js";
import { MiniCache } from "./miniCache.js";

const cache = new MiniCache()

/**
 * Fetches and caches the OIDC discovery document for the provided issuer,
 * validating the issuer match before returning metadata.
 *
 * @param issuer - Base issuer URL configured for the provider.
 * @param log - Pino logger used for diagnostics.
 * @returns Parsed discovery metadata.
 *
 * @example
 * const meta = await discoverOidc(provider.issuer, log);
 */
export async function discoverOidc(issuer: string, log: pino.Logger): Promise<any | void>{
    const {OAuthProviders} = getConfiguration()
    if (!OAuthProviders) return;

    const exists = cache.get(issuer)

    if (exists) return exists;
    const normalize = (u: string) => u.endsWith('/') ? u.slice(0, -1) : u;
     try {
         const discoveryUrl = new URL(".well-known/openid-configuration", normalize(issuer)).toString();
         const res = await fetch(discoveryUrl, {headers: {
            "Accept": "application/json" 
         }}) 
         const contentType = res.headers.get('Content-Type')
         let json;

         if (contentType && !contentType.toLowerCase().startsWith('application/json')) {
            log.error({statusCode: res.status, fullResponse: res, contentType}, `discovery failed for ${issuer}, Unexpected content type`)
            throw new Error(`discovery failed for ${issuer}, Unexpected content type`)
         }

         json = await res.json()

         if (!res.ok || res.status !== 200) {
            log.error({statusCode: res.status, fullResponse: json}, `discovery failed for ${issuer}`)
            throw new Error(`Discover of oidc failed with status code ${res.status} full response: ${json}`)
         }

         if (normalize(json.issuer) !== normalize(issuer)) {
            log.error({statusCode: res.status, fullResponse: json}, 
                `The issuer ${issuer} in the configuration is not equal to the discovered one!`)
            throw new Error(`The issuer ${issuer} in the configuration is not equal to the discovered one!`)
         }

         cache.set(issuer, json, 1000 * 60 * 60 * 48)
         return json;

     } catch(err) {
        log.error({err}, `discovery failed for ${issuer}`)
        throw err;
     }
}
