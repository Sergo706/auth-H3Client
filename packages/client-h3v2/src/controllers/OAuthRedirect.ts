import { getRequestIP, H3Event, redirect } from "h3";
import crypto from 'crypto';
import { getLogger } from "@internal/shared";
import { getConfiguration } from "@internal/shared";
import { makeCookie } from "../utils/cookieGenerator.js";
import { makePkcePair } from "@internal/shared";
import throwError from "../middleware/error.js";
import { discoverOidc } from "@internal/shared";
import { createSignedCookie } from "@internal/shared";

/**
 * Initiates the OAuth/OIDC authorization flow for the requested provider by
 * preparing state, PKCE values, and redirecting the user to the provider's login page.
 *
 * @param event - H3 event for the OAuth redirect request.
 * @returns Redirect response pointing to the provider authorization endpoint.
 *
 * @example
 * router.get('/oauth/:provider', OAuthRedirect);
 */
export async function OAuthRedirect(event: H3Event) {
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

   log.info(`Entered OAuth flow for ${match.name}`)

  const statePayload = JSON.stringify({ p: match.name, r: crypto.randomBytes(32).toString('hex') });
  const state = createSignedCookie(statePayload, 1000 * 60 * 3, `auth-oauth.${match.name}`)
  const nonce = crypto.randomBytes(32).toString('base64url');
  const { verifier, challenge } = makePkcePair();

  const isFormPost = match.extraAuthParams?.response_mode === 'form_post';
  const sameSiteMode = isFormPost ? 'none' : 'lax';

 makeCookie(event, `state${match.name}`, state, {
    httpOnly: true,
    sameSite: sameSiteMode,
    secure: true, 
    path: '/',  
    maxAge: 60 * 3,
   })

if (match.supportPKCE) {
  makeCookie(event, `pkce_v${match.name}`, verifier, {
     httpOnly: true,
     sameSite: sameSiteMode,
     secure: true, 
     path: '/',  
     maxAge: 60 * 3,
   })
}

   if (match.kind === 'oidc')  {
     makeCookie(event, `nonce${match.name}`, nonce, {
     httpOnly: true,
     sameSite: sameSiteMode,
     secure: true, 
     path: '/',  
     maxAge: 60 * 3,
   })
   }

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

        } else {
            url = new URL(match.authorizationEndpoint);
            url.searchParams.set("client_id", match.clientId);
            url.searchParams.set("redirect_uri", match.redirectUri);
            url.searchParams.set("response_type", "code");
            url.searchParams.set("scope", (match.defaultScopes ?? []).join(" "));
            url.searchParams.set("state", state);
         }

         if (match.supportPKCE) {
            url.searchParams.set("code_challenge", challenge);
            url.searchParams.set("code_challenge_method", "S256");
          }

        if (match.extraAuthParams) {
            log.info('Setting extra params')
            for (const [key,value] of Object.entries(match.extraAuthParams)) url.searchParams.set(key, value);
        }

         if (!url) {
                throwError(log,event,'SERVER_ERROR',500,'SERVER_ERROR','','Error constructing the uri please check your configuration and try again.')
            }
          return redirect(url.toString());
}
