import pino from "pino";
import { getConfiguration } from "../config/config";
import { MiniCache } from "./miniCache";

const cache = new MiniCache()

export async function discoverOidc(issuer: string, log: pino.Logger): Promise<any | void>{
    const {OAuthProviders} = getConfiguration()
    if (!OAuthProviders) return;

    const exists = cache.get(issuer)

    if (exists) return exists;

     try {
         const res = await fetch(new URL("/.well-known/openid-configuration", issuer))   
         const json = await res.json()

         if (!res.ok || res.status !== 200) {
            log.error({statusCode: res.status, fullResponse: json}, `discovery failed for ${issuer}`)
            throw new Error(`Discover of oidc failed with status code ${res.status} full response: ${json}`)
         }

         if (json.issuer !== issuer) {
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