import crypto from "crypto";
import { createSignedCookie, safeAction } from "@internal/shared";
import { verifySignedCookie } from "@internal/shared";
import { getLogger} from "@internal/shared";
import { getCookie, getRequestURL, H3Event, createError, parseCookies, getRequestIP, getRequestHeader, getHeader } from "h3";
import { getConfiguration } from "@internal/shared";
import { checkForBots } from "../utils/checkForBots.js";

/**
 * Validates visitor canary cookies, bootstrapping tracking metadata and banning
 * suspicious clients via the auth server when anomalies are detected.
 *
 * @param event - H3 event for the incoming page request.
 * @returns void Resolves when validation completes; throws on suspicious activity.
 *
 * @example
 * await validator(event);
 */
export const validator = async (event: H3Event): Promise<any> => {
    const log = getLogger().child({service: `auth-client`, branch: 'BOT DETECTOR', type: 'middleware', reqID: event.context.rid})
    const url = getRequestURL(event);
    const {enableFireWallBans} = getConfiguration()
    const isPageView =
    !url.pathname.match(/\.(css|js|png|jpe?g|svg|ico|woff2?|ttf|map|webp|json)$/i);
    const isOAuth = url.pathname.startsWith("/oauth/");
    if (!isPageView || isOAuth) return;
    
    const COOKIE_NAME = "__Host-dr_i_n";
    const canary = getCookie(event, 'canary_id')
    const rawCookie = getCookie(event, COOKIE_NAME);

    log.info({canary: canary, HostCookie: rawCookie},'Entered Validator');
    
    if (rawCookie && canary) {
      if (!verifySignedCookie(rawCookie, 'normal').valid) {
        log.warn('[FE] Host-dr_i_n Not verified tempering detected');

        throw createError({
            data: { date: new Date().toJSON(), code: 'CANARY_TEMPERING' },
            status: 403,
            statusText: "Forbidden",
        })
      }
       log.info('[FE] verified __Host cookie, skipping /check');
    } else {

      const newUuid = crypto.randomBytes(32).toString("hex");
      const cookieValue = createSignedCookie(newUuid, 1000 * 60 * 60 * 2, 'normal');
      log.info({cookies: parseCookies(event)},`Sending request for /check`)
      
      const xReal = getHeader(event, 'x-real-ip')
      const clientIp = xReal || getRequestIP(event, {xForwardedFor: true}) || undefined
      
      if (canary || rawCookie) {
        const key = canary || rawCookie as string;
        return safeAction(key, 
        async () => 
          await checkForBots({name: COOKIE_NAME, value: cookieValue}, event, event.method, log, enableFireWallBans, canary)
      , 5000)
      } else {
        return safeAction(`${clientIp}:${getRequestHeader(event, 'User-Agent')}`, async () => 
           await checkForBots({name: COOKIE_NAME, value: cookieValue}, event, event.method, log, enableFireWallBans, canary)
        , 5000)
      }
}
};