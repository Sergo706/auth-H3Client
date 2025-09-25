import pino from "pino";
import { getConfiguration } from "../config/config";
import { MiniCache } from "./miniCache";

export async function discoverOidc(issuer: string, log: pino.Logger): Promise<any | void>{
    const {OAuthProviders} = getConfiguration()
    if (!OAuthProviders) return;

    const cache = new MiniCache()
    const exists = cache.get(issuer)

    if (exists) return exists;

     try {
         const res = await fetch(new URL("/.well-known/openid-configuration", issuer))   
         const json = await res.json()
         cache.set(issuer, json, 1000 * 60 * 60 * 48)
         
         return json;
     } catch(err) {
        log.error({err}, `discovery failed for ${issuer}`)
        throw err;
     }
}