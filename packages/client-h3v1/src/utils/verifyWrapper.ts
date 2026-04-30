import { appendHeader, defineEventHandler, EventHandler, EventHandlerRequest, getHeader, setResponseStatus } from "h3";
import { getLogger, parseResponseContentType, privilegeQ, Results, VerifySuccessResponse } from "@internal/shared";
import z from "zod";
import { sendToServer } from "./serverToServer.js";


export type Privilege = z.infer<typeof privilegeQ>

export const defineAuthenticatePublicApi = <T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>,
  userPrivilege: Privilege, // the current 'plan' or privilege of the user/consumer etc..
): EventHandler<T, Promise<D>> => {

    return defineEventHandler(async (event) => { 
          const log = getLogger().child({service: `auth-client`, branch: 'api_tokens_verify', reqId: event.context.rid });
          const apiToken = getHeader(event, 'X-API-KEY')
          
          if (!apiToken) {
            log.info('No api key is provided')
            setResponseStatus(event, 401)
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: 'No api key provided'
            }
          }

          // no deduplication here. since it will affect pricing on successful reqs. userPrivilege comes from app understanding of privilege
        const res = await sendToServer(false, `/api/public/verify/?privilege=${userPrivilege}`, 'GET', event, false, undefined, undefined, undefined, apiToken)

        if (!res) {
            log.error('Server responded null')
            setResponseStatus(event, 500)
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: "Internal Server Error"
            }
        };
        
        // only rate limit on problems, and security. successful rate limit is app business
        if (res.status === 429) {
            const retrySec = res.headers.get('Retry-After');
            appendHeader(event, 'Retry-After', Number(retrySec));
            setResponseStatus(event, 429)
            return {
                ok: false,
                date: new Date().toISOString(),
                reason: 'To many requests. check "Retry-After" header when to try again.'
            }
        }

        const parsedRes = await parseResponseContentType(log, res) as Results<VerifySuccessResponse>;
        
        if (res.status !== 200 && !parsedRes.ok || !parsedRes.ok) {
             setResponseStatus(event, res.status)
             return {
                 ok: false,
                 date: parsedRes.date,
                 reason: parsedRes.reason
             }
        }


            event.context.apiVerification = parsedRes.data;
           return handler(event);
         }) as EventHandler<T, Promise<D>>

}