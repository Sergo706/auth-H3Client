import { getCookie, getRequestIP, H3Event, redirect } from "h3";
import { getLogger } from "../utils/logger.js";
import { getConfiguration } from "../config/config.js";
import throwError from "../middleware/error.js";
import { sendToServer } from "../utils/serverToServer.js";
import { parseResponseContentType } from "../utils/checkResponseType.js";
import { makeCookie } from "../utils/cookieGenerator.js";
import { safeObjectMerge } from "../utils/safeMerge.js";
import { findStringsInObject } from "../utils/findObjectValues.js";



export async function OAuthCallback(event: H3Event) {

    const log = getLogger().child({service: 'auth-client', branch: 'OAuth', type: 'handler-success-callback', reqId: event.context.rid, reqIp: getRequestIP(event)});
    const { OAuthProviders, domain } = getConfiguration()   
    const provided = event.context.params?.provider; 

 if (!OAuthProviders || !provided) {
        throwError(log,event,'NOT_FOUND',404,'NOT_FOUND',"This page doesn't exists", "Entered invalid callback uri")
 };
    
 const match = OAuthProviders.find(pro => pro.name === provided);

 if (!match) {
     throwError(log,event,'NOT_FOUND',404,'NOT_FOUND',"This page doesn't exists", "Error searching for this provider, make sure the route === provider name")
   }

   const contexts = {
        provider: event.context.provider,
        userData: event.context.userData,
        accessToken: event.context.accessToken
   }

   if (!contexts.provider || !contexts.userData || !contexts.accessToken)  {
         throwError(log,event,'AUTH_CLIENT_ERROR',400,'Bad request',"Bad request", 
            "Provider in context or userData doesn't exists.")
   }

 log.info(`Token verified, and OAuth flow completed, sending data to the server... for ${match.name}`);
 let user = { ...(contexts.userData as any) };


   if (!(contexts.userData as any).email && 
   match.kind === 'oauth' && 
   typeof match.emailCallBack === 'function') {

    try {
      const email = await match.emailCallBack(contexts.accessToken as string);
      if (!email || typeof email !== 'string') {
        throwError(log,event,'AUTH_CLIENT_ERROR',500,'Server Error','',`OAuth flow failed for ${contexts.provider} Email callback should return a single string.`)
      }
      user.email = email
    } catch(err) {
        throwError(log,event,'AUTH_CLIENT_ERROR',500,'Server Error','',`Email callback resolved with an error. ${err}`)
    }
   }

   if (match.kind === 'oauth' && match.extraUserInfoCallBacks) {
      const callbacks = match.extraUserInfoCallBacks;
      try {
        const extras = await Promise.all(callbacks.map(async call => await call(contexts.accessToken as string)))
        for (const data of extras) {
         if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throwError(log, event, 'AUTH_CLIENT_ERROR', 500, 'Server Error', '',
              `extraUserInfoCallBacks must return plain objects`);
          }
            safeObjectMerge(user, data,  {
              mode: 'drop',
              onConflict: (key, incoming, existing) => {
                log.warn({ key, incoming, existing }, 'Ignoring overwrite of reserved key from extraUserInfoCallBacks');
              }
            })
        }
      } catch(err) {
          throwError(log,event,'AUTH_CLIENT_ERROR',500,'Server Error','',`One of extraUserInfoCallBacks resolved with an error. ${err}`)
      }
   }

   if (!user.email && match.kind === 'oauth') {
      const data = user as any;
      const regex = /^(?!\.)(?!.*\.\.)([a-z0-9_'+\-\.]*)[a-z0-9_+-]@([a-z0-9][a-z0-9\-]*\.)+[a-z]{2,}$/i;
      let email: string | null = null;

      for (const [key,value] of Object.entries(data)) {
       const found = key.toLowerCase().includes('email');
       const valueMatch = typeof value === 'string' && regex.test(value.trim());

       if (found && valueMatch) {
          email = value.trim();
          break;
        }
      }

    if (!email) {
      email = findStringsInObject(data, undefined, {
        keyToSearch: 'email',
        value: regex
      });
      if (email) log.info("Email found");
    }

    if (email) {
      user.email = email;
    } else {
      throwError(log,event,'MISSING_BODY',400,'Missing Email','',`${contexts.provider}, missing an email   address, and the callback couldn't find one. 
          Consider providing a callback that return an email address.
      `)   
      }
   }

const canary_id = getCookie(event, 'canary_id'); 
const cookies = [
        {
      label: 'canary_id',
      value: canary_id
    }
]
const { data, ...restUser } = user as any;
const normalized = data ? { ...restUser, ...data } : restUser;

 try {
    const sendData = await sendToServer(false, `/auth/OAuth/${contexts.provider}`, 'POST', event, true, cookies, normalized);
    if (!sendData) {
            throwError(log,event,'SERVER_ERROR', 500, 'Server Error', 'Server error please try again later', 'Api Call Failed')
          };
        
     const results = await parseResponseContentType(log, sendData);

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
                     domain: domain,
                     maxAge: 16 * 60
                 })
                 makeCookie(event, 'a-iat', accessIat, {
                     httpOnly: true,
                     sameSite: 'strict',
                     secure:   true,
                     path: '/',
                     domain: domain,
                     maxAge: 16 * 60
                 })
             }  

            log.info({server: results},`user redirected successfully to his account.`);
            event.res.headers.set("Content-Type", "text/html;charset=UTF-8");
            event.res.headers.set('Cache-Control', 'no-store');
            event.res.headers.set('Pragma', 'no-cache');
            event.res.status = 200
            return `
            <!DOCTYPE html>
              <html>
                <head>
                <meta http-equiv="refresh" content="0;url=${match.redirectUrlOnSuccess}">
            <script>window.location.replace(${match.redirectUrlOnSuccess});</script>
                </head>
                <body>
                </body>
            </html>
            `;
    };           
  } catch(err) {
    throwError(log,event,'AUTH_SERVER_ERROR',500,'SERVER_ERROR','',`${err},Unexpected error`)
  }
}