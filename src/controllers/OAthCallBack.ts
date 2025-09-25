import { getLogger } from '../utils/logger.js';
import { getConfiguration } from "../config/config.js";
import { defineHandler, deleteCookie, getCookie, getQuery, getRequestIP, redirect } from "h3";
import throwError from "../middleware/error.js";
import { discoverOidc } from '../utils/discoverOidc.js';
import { verifyOAthToken } from '../utils/verifyOAuthTokens.js';
import { sendToServer } from '../utils/serverToServer.js';
import { makeCookie } from '../utils/cookieGenerator.js';

export default defineHandler(async (event) => {
const log = getLogger().child({service: 'auth-client', branch: 'OAuth', type: 'handler-callback', reqId: event.context.rid, reqIp: getRequestIP(event)});
const { OAuthProviders } = getConfiguration()   
const provided = event.context.params?.provider;

log.info('Entered OAuth Callback.')

 if (!OAuthProviders || !provided) {
    throwError(log,event,'NOT_FOUND',404,'NOT_FOUND',"This page doesn't exists", "Entered invalid callback uri")
 };

 const match = OAuthProviders.find(pro => pro.name === provided);

if (!match) {
 throwError(log,event,'NOT_FOUND',404,'NOT_FOUND',"This page doesn't exists", "Error searching for this provider, make sure the route === provider name")
}

const { code, state:stateFromIdP, error, iss } = getQuery(event);

    if (error) {
        log.error({error},'OAth callback failed with an error');
        redirect(event, match.redirectUrlOnError)  
    }
    const stateCookie = getCookie(event, "state");

    if (!stateCookie || stateFromIdP !== stateCookie) {
        throwError(log,event,'AUTH_CLIENT_ERROR',400,'Bad request','', 'Invalid states');
    }
    const parsedState = JSON.parse(Buffer.from(stateCookie, "base64url").toString("utf8"));
    if (parsedState.p !== provided) {
        throwError(log,event,'INVALID_CREDENTIALS',400,'Bad request','',"state doesn't match provided provider")
    }

    if (iss && match.kind === "oidc" && iss !== match.issuer) {
        throwError(log,event,'INVALID_CREDENTIALS',400,'Bad request','',"Issuer mismatch")
    }

   const codeVerifier = getCookie(event, 'pkce_v');
   const nonce = getCookie(event, "nonce");
   deleteCookie(event,"pkce_v")
   deleteCookie(event,"nonce")
   deleteCookie(event,"state")

   log.info(`Exchanging code for token...`);


   const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: match.redirectUri,
      client_id: match.clientId,
      client_secret: match.clientSecret
    });

    if (codeVerifier) params.set("code_verifier", codeVerifier); 

    const tokenEndpoint = match.kind === "oidc" ? (await discoverOidc(match.issuer, log)).token_endpoint : match.tokenEndpoint;
      
     const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });

    if (!tokenRes.ok) {
        log.error({tokenRes},'failed to get access token');
        redirect(event, match.redirectUrlOnError)  
    }

   const tokens = await tokenRes.json();

   if (!tokens.id_token) {
        log.error({tokenRes},'token exchange succeeded, but token ended up null');
        redirect(event, match.redirectUrlOnError)  
   }

    let user;
    if (match.kind === "oidc" && tokens.id_token) {
      const meta = await discoverOidc(match.issuer, log);
      const payload = await verifyOAthToken(tokens.id_token, meta.jwks_uri, match.issuer, match.clientId)

      if (payload.nonce !== nonce) {
        throwError(log,event,'INVALID_CREDENTIALS',500,'server error','','Nonce mismatch!')
      }
    
      if (payload.azp && payload.azp !== match.clientId) {
        throwError(log,event,'INVALID_CREDENTIALS',500,'server error','','azp mismatch!')
      }

      if (meta.userinfo_endpoint && tokens.access_token) {
        const userinfo = await fetch(meta.userinfo_endpoint, { 
            headers: { 
                Authorization: `Bearer ${tokens.access_token}` }
            });

        const userinfoJson = userinfo.ok ? await userinfo.json() : {};
        user = { ...userinfoJson, sub: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
      } else {
        user = { sub: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
      }
    } else if (match.kind === "oauth") {
      const info = await fetch(match.userInfoEndpoint, { 
        headers: { 
            Authorization: `Bearer ${tokens.access_token}` 
        }});

      if (!info.ok) {
        throwError(log,event,'MISSING_BODY',500,'Server error','', 'failed to get user info')
      }
      user = await info.json();
    } else {
        throwError(log,event,'SERVER_ERROR',500,'Server error','', 'Unexpected error')
    }

    // create own session / cookies here…

    const canary_id = getCookie(event, 'canary_id'); 
    const cookies = [
        {
      label: 'canary_id',
      value: canary_id
    }
]

     log.info(`Token verified, and OAuth flow completed, sending data to the server...`);
        try {
        const sendData = await sendToServer(false, `/auth/OAth/${provided}`, 'POST', event, true, cookies, { user });
        
        if (!sendData) {
        throwError(log,event,'SERVER_ERROR', 500, 'Server Error', 'Server error please try again later', 'Api Call Failed')
      };
    
     const results = await sendData.json() as any;

    if (sendData.status === 201 || sendData.status === 200) {
        log.info(`Verification succeeded! Redirecting user...`);

        const cookies = sendData.headers.getSetCookie();
        const accessToken = results.accessToken;    
        const accessIat = results.accessIat;    

        cookies.forEach(line => event.res.headers.append('Set-Cookie', line));
        if (accessToken) {
            makeCookie(event, '__Secure-a', accessToken, {
                httpOnly: true,
                sameSite: 'strict',
                secure:   true,
                path: '/',
                domain: 'riavzon.com',
                maxAge: 16 * 60 * 1000
            })
            makeCookie(event, 'a-iat', accessIat, {
                httpOnly: true,
                sameSite: 'strict',
                secure:   true,
                path: '/',
                domain: 'riavzon.com',
                maxAge: 16 * 60 * 1000
            })
        }   
       
            log.info({server: results},`user redirected successfully to his account.`);
            redirect(event, match.redirectUrlOnSuccess)
        return; 
    } 

  } catch(err) {
    throwError(log,event,'AUTH_SERVER_ERROR',500,'SERVER_ERROR','',`${err},Unexpected error`)
  }
})