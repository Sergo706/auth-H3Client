import crypto from "crypto";
import { createSignedCookie } from "../utils/cryptoCookies.js"
import { verifySignedCookie } from "../utils/cryptoCookies.js"
import { makeCookie } from "../utils/cookieGenerator.js";
import { banIp } from "../utils/banIp.js";
import { getLogger} from "../utils/logger.js";
import { getCookie, getRequestIP, getRequestURL, H3Event, HTTPError, parseCookies } from "h3";
import { sendToServer } from "../utils/serverToServer.js";
import throwError from "./error.js";


export const validator = async (event: H3Event): Promise<any> => {
    const log = getLogger().child({service: `auth-client`, branch: 'BOT DETECTOR', type: 'middleware', reqID: event.context.rid})
    const url = getRequestURL(event);

    const isPageView =
    !url.pathname.match(/\.(css|js|png|jpe?g|svg|ico|woff2?|ttf|map|webp|json)$/i);
    if (!isPageView) return;
    
    const COOKIE_NAME = "__Host-dr_i_n";
    const canary = getCookie(event, 'canary_id')
    const rawCookie = getCookie(event, COOKIE_NAME);

    log.info({canary: canary, HostCookie: rawCookie},'Entered Validator');
    
    if (rawCookie && canary) {
      if (!verifySignedCookie(rawCookie, 'normal').valid) {
        const imageUrl = '/assets/tea.png';
        log.warn('[FE] Host-dr_i_n Not verified tempering detected');

        throw new HTTPError({
            body: { date: new Date().toJSON(), code: 'CANARY_TEMPERING' },
            status: 403,
            statusText: "Forbidden",
        })
      }
       log.info('[FE] verified __Host cookie, skipping /check');
    } else {

      const newUuid = crypto.randomBytes(32).toString("hex");
      const cookieValue = createSignedCookie(newUuid, 1000 * 60 * 60 * 2, 'normal');
      log.info({cookies: parseCookies(event)},`Sending request for /check`)
 
  try {
    const trackRes = await sendToServer(true, `/check`, event.req.method, event, false)
    if (!trackRes) {
      throwError(log,event,'AUTH_SERVER_ERROR',502,'Not reachable','','Auth server is not reachable!')
    };

    const status = trackRes.status;
    
    if (status === 403) {
    const message = await trackRes.text();
     log.info('Detected malicious user starting banning');
     banIp(getRequestIP(event)!);
     log.info('Banning completed');
     throw new HTTPError({
        body: { date: new Date().toJSON(), code: 'NOT_ALLOWED' },
        status: 403,
        statusText: "Forbidden",
        message: message
     })
    }
    
    const setCookies = trackRes.headers.get('set-cookie');
    if (setCookies) {
       event.res.headers.append('Set-Cookie', setCookies) 
    }

    const results = await trackRes.json(); 
    log.info({results}, `Checking completed.`);
    event.context.trackingResult = results;

    
    makeCookie(event, COOKIE_NAME, cookieValue, {
      httpOnly: true,
      sameSite: "strict", 
      maxAge: 60 * 60 * 2,
      secure: true,
    })
    return;
  } catch (err: any) {
    log.error({ err }, `Error in frontend botDetector`);
    throw new HTTPError({
        body: { date: new Date().toJSON(), code: 'SERVER_ERROR' },
        status: 502,
        statusText: "Server Error",
        message: 'Something went wrong, please try restarting the page, and try again.' ,
    })
  };
}
};



