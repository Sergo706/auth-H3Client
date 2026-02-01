import { appendHeader, createError, getRequestIP, H3Error, H3Event } from "h3";
import pino from "pino";
import throwError from "../middleware/error.js";
import { banIp } from "@internal/shared";
import { sendToServer } from "./serverToServer.js";
import { makeCookie } from "./cookieGenerator.js";


export async function checkForBots(cookies: {name: string, value: string}, event: H3Event, method: string, log: pino.Logger, enableFireWallBans: boolean, canary?: string): Promise<void | H3Error<unknown>> {

 try {
    const trackRes = await sendToServer(true, `/check`, method, event, false, 
    canary ? 
    { label: 'canary_id', value: canary } : undefined)
    
    if (!trackRes) {
      throwError(log,event,'AUTH_SERVER_ERROR',502,'Not reachable','','Auth server is not reachable!')
    };

    const status = trackRes.status;
    
    if (status === 403) {
    const message = await trackRes.text();
    log.info('Detected malicious user');
    
    if (enableFireWallBans) {
        log.info('Starting banning');
        banIp(getRequestIP(event)!);
       log.info('Banning completed');
     }

     throw createError({
        data: { date: new Date().toJSON(), code: 'NOT_ALLOWED' },
        status: 403,
        statusText: "Forbidden",
        message: message
     })
    }
    
    const setCookies = trackRes.headers.get('set-cookie');
    if (setCookies) {
       appendHeader(event, 'Set-Cookie', setCookies) 
    }

    const results = await trackRes.json(); 
    log.info({results}, `Checking completed.`);
    event.context.trackingResult = results;

    
    makeCookie(event, cookies.name, cookies.value, {
      httpOnly: true,
      sameSite: "strict", 
      maxAge: 60 * 60 * 2,
      secure: true,
    })

    return;
  } catch (err: any) {
    log.error({ err }, `Error in frontend botDetector`);
    throw createError({
        data: { date: new Date().toJSON(), code: 'SERVER_ERROR' },
        status: 502,
        statusText: "Server Error",
        message: 'Something went wrong, please try restarting the page, and try again.' ,
    })
  };
}