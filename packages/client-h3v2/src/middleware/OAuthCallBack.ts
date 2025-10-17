import { getLogger } from '../utils/logger.js';
import { getConfiguration } from "../config/config.js";
import { deleteCookie, getCookie, getRequestIP, getValidatedQuery, H3Event, redirect } from "h3";
import throwError from "./error.js";
import { discoverOidc } from '../utils/discoverOidc.js';
import { verifyOAuthToken } from '../utils/verifyOAuthTokens.js';
import { verifySignedCookie } from '../utils/cryptoCookies.js';
import { query } from '../types/OAuthQuery.js';
import { atHashCheck } from '../utils/atHash.js';
import type { OidcIdTokenPayload } from '../types/oidc.js'


/**
 * Validates the OAuth/OIDC callback query, exchanges codes for tokens, and stores provider
 * metadata on the request context for downstream handlers.
 *
 * @param event - H3 event representing the OAuth callback.
 * @returns void
 *
 * @example
 * router.get('/oauth/callback/:provider', OAuthCallback, { middleware: [OAuthTokensValidations] });
 */
export async function OAuthTokensValidations(event: H3Event) {
const log = getLogger().child({service: 'auth-client', branch: 'OAuth', type: 'handler-callback-middleware', reqId: event.context.rid, reqIp: getRequestIP(event)});
const { OAuthProviders } = getConfiguration()   
const provided = event.context.params?.provider;


 if (!OAuthProviders || !provided) {
    throwError(log,event,'NOT_FOUND',404,'NOT_FOUND',"This page doesn't exists", "Entered invalid callback uri")
 };

 const match = OAuthProviders.find(pro => pro.name === provided);

  if (!match) {
    throwError(log,event,'NOT_FOUND',404,'NOT_FOUND',"This page doesn't exists", "Error searching for this provider, make sure the route === provider name")
  }

log.info(`Entered OAuth Callback. for ${match.name}`)
const clearCookies = () => {
    deleteCookie(event,`pkce_v${match.name}`)
    deleteCookie(event,`nonce${match.name}`)
    deleteCookie(event,`state${match.name}`);
}

const { code, state:stateFromIdP, error, iss } = await getValidatedQuery(event, query);

    if (error) {
        log.error({error},'OAuth callback failed with an error');
        clearCookies()
        return redirect( match.redirectUrlOnError); 
    }

    const stateCookie = getCookie(event, `state${match.name}`);

    if (!code) {
        clearCookies()
        log.error({error},`OAuth callback failed. provider didn't provided code.`);
        return redirect( match.redirectUrlOnError); 
    }
    
    if (!stateCookie || !stateFromIdP  || stateFromIdP !== stateCookie) {
      clearCookies()
      throwError(log,event,'INVALID_CREDENTIALS',400,'Bad request','', 'State is missing');
    }


    const state = verifySignedCookie(stateFromIdP, `auth-oauth.${provided}`)

    if (!state.valid || state.payload?.session !== `auth-oauth.${provided}`) {
       clearCookies()
       throwError(log,event,'INVALID_CREDENTIALS',400,'Bad request','', 'State is not valid');
     }


    if (iss && match.kind === "oidc" && iss !== match.issuer) {
        clearCookies()
        throwError(log,event,'INVALID_CREDENTIALS',400,'Bad request','',"Issuer mismatch")
    }

   const codeVerifier = getCookie(event, `pkce_v${match.name}`);
   const nonce = getCookie(event, `nonce${match.name}`);
   clearCookies()

   log.info(`Exchanging code for token...`);


   const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: match.redirectUri,
      client_id: match.clientId,
      client_secret: match.clientSecret,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      "Accept": "application/json"
   };

    if (codeVerifier) params.set("code_verifier", codeVerifier); 
    
    const meta = match.kind === 'oidc' ? await discoverOidc(match.issuer, log) : undefined;
    const tokenEndpoint = match.kind === 'oidc' ? meta!.token_endpoint : match.tokenEndpoint;

    let method: 'client_secret_basic' | 'client_secret_post';
    const supported = meta?.token_endpoint_auth_methods_supported as string[] | undefined;

    method = match.tokenAuthMethod ?? (
      !Array.isArray(supported) || supported.includes('client_secret_basic') 
            ? 'client_secret_basic'
            : 'client_secret_post');
        

    if (method === 'client_secret_basic') {
      const basic = Buffer.from(`${match.clientId}:${match.clientSecret}`).toString('base64');
      headers.Authorization = `Basic ${basic}`;
      params.delete('client_id');
      params.delete('client_secret');
    }

     const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers,
      body: params
    });

    if (!tokenRes.ok) {
        log.error({status: 'missing_access_token' },'failed to get access token');
        return redirect( match.redirectUrlOnError); 
    }

   const tokens = await tokenRes.json();

    let user;
    if (match.kind === "oidc" && tokens.id_token) {

      const payload: OidcIdTokenPayload = await verifyOAuthToken(tokens.id_token, meta.jwks_uri, match.issuer, match.clientId)

      if (payload.nonce !== nonce) {
        throwError(log,event,'INVALID_CREDENTIALS',400,'Bad request','','Nonce mismatch!')
      }
    
      if (payload.azp && payload.azp !== match.clientId) {
        throwError(log,event,'INVALID_CREDENTIALS',400,'Bad request','','azp mismatch!')
      }

      if (payload.at_hash && typeof tokens.access_token === 'string' && typeof payload.at_hash === 'string') {
           const valid = atHashCheck(payload.at_hash, tokens.access_token, tokens.id_token)

           if (!valid) 
              throwError(log, event, 'INVALID_CREDENTIALS', 400, 'Bad request', '', 'at_hash mismatch');
      }

      if (meta.userinfo_endpoint && tokens.access_token) {
        const userinfo = await fetch(meta.userinfo_endpoint, { 
            headers: { 
                Authorization: `Bearer ${tokens.access_token}` }
            });

        const userinfoJson = userinfo.ok ? await userinfo.json() : {};

       if (userinfo.ok && userinfoJson.sub !== payload.sub) {
          throwError(log,event,'INVALID_CREDENTIALS',400,'Bad request','', 'userinfo.sub does not match id_token.sub');
        }
        
        user = { ...userinfoJson, sub: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
      } else {
        user = { ...payload, sub: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
      }
    } else if (match.kind === "oauth") {

      if (!tokens.access_token) {
        log.error({ status: 'missing_access_token' }, 'OAuth flow succeeded, but the required access_token was missing.');
        return redirect( match.redirectUrlOnError);
     }

      const info = await fetch(match.userInfoEndpoint, { 
        headers: { 
            Authorization: `Bearer ${tokens.access_token}` 
        }});

      if (!info.ok) {
         const err = await info.json();
        throwError(log,event,'MISSING_BODY',500,'Server error','', `failed to get user info. Provider Response: ${JSON.stringify(err)}`)
      }
      user = await info.json();
    } else {
        throwError(log,event,'SERVER_ERROR',500,'Server error','', 'Unexpected error')
    }

  event.context.provider = match.name;
  event.context.userData = user;
  event.context.accessToken = tokens.access_token;
}
