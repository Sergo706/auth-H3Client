import { defineHandler, getRequestIP, redirect } from "h3";
import crypto from 'crypto';
import { getLogger } from '../utils/logger.js';
import { getConfiguration } from "../config/config.js";
import { makeCookie } from "../utils/cookieGenerator.js";
import { makePkcePair } from "../utils/pkce.js";
import throwError from "../middleware/error.js";
import { discoverOidc } from "../utils/discoverOidc";


export default defineHandler(async (event) => {
const { OAuthProviders } = getConfiguration()   
const log = 
getLogger().child({service: 'auth-client', branch: 'OAuth', type: 'handler-redirect', reqId: event.context.rid, reqIp: getRequestIP(event)});
const provided = event.context.params?.provider;

 if (!OAuthProviders || !provided) {
    throwError(log,event,'NOT_FOUND',404,'NOT_FOUND',"This page doesn't exists", "This provider doesn't exists yet.")
 };

const match = OAuthProviders.find(pro => pro.name === provided);

if (!match) {
 throwError(log,event,'NOT_FOUND',404,'NOT_FOUND',"This page doesn't exists", "Error searching for this provider, make sure the route === provider name")
}

  const statePayload = { p: match.name, t: Date.now() }; 
  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");
  const nonce = crypto.randomBytes(32).toString('base64url');
  const { verifier, challenge } = makePkcePair();


 makeCookie(event, "state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true, 
    path: '/',  
    maxAge: 60 * 3,
   })

 makeCookie(event, "pkce_v", verifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: true, 
    path: '/',  
    maxAge: 60 * 3,
  })
    makeCookie(event, "nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: true, 
    path: '/',  
    maxAge: 60 * 3,
  })

    log.info('Setting params...')
    let url: URL;
    if (match.kind === 'oidc') {
       const meta = await discoverOidc(match.issuer, log);
        url = new URL(meta.authorization_endpoint);
        url.searchParams.set("client_id", match.clientId);
        url.searchParams.set("redirect_uri", match.redirectUri);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", (match.defaultScopes ?? ["openid","email","profile"]).join(" "));
        url.searchParams.set("state", state);
        url.searchParams.set("nonce", nonce);
        url.searchParams.set("code_challenge", challenge);
        url.searchParams.set("code_challenge_method", "S256"); 

        if (match.extraAuthParams) {
            log.info('Setting extra params')
            for (const [key,value] of Object.entries(match.extraAuthParams)) url.searchParams.set(key, value);
        }
        } else {
            url = new URL(match.authorizationEndpoint);
            url.searchParams.set("client_id", match.clientId);
            url.searchParams.set("redirect_uri", match.redirectUri);
            url.searchParams.set("response_type", "code");
            url.searchParams.set("scope", (match.defaultScopes ?? []).join(" "));
            url.searchParams.set("state", state);

             if (match.supportPKCE) {
                url.searchParams.set("code_challenge", challenge);
                url.searchParams.set("code_challenge_method", "S256");
              }

            }
            if (!url) {
                throwError(log,event,'SERVER_ERROR',500,'SERVER_ERROR','','Error constructing the uri please check your configuration and try again.')
            }
          return redirect(event, url.toString());
})