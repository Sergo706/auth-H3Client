import { sendToServer } from "./serverToServer.js";
import { getLogger, parseResponseContentType, Results, safeAction } from "@internal/shared";
import { assertMethod, defineEventHandler, EventHandler, EventHandlerRequest, getCookie, getQuery } from "h3";
import throwError  from "../middleware/error.js";
import { VerificationLinkSchema, verificationLink } from "@internal/shared";
import { validateZodSchema } from "@internal/shared";
import { defineVerifiedCsrfHandler } from "./csrfVerifier.js";

export const defineVerifiedMagicLinkGetHandler = <T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>
): EventHandler<T, Promise<D>> => {
  const log = getLogger().child({ service: 'auth-client', branch: 'custom-mfa', type: 'link-verifier' });

  return defineVerifiedCsrfHandler(
    defineEventHandler(async (event) => {
        assertMethod(event, "GET")
        log.info('Verifying link...')
        const query = getQuery<VerificationLinkSchema>(event)
        const canary = getCookie(event, 'canary_id');
        const refresh = getCookie(event, 'session');
        const validation = validateZodSchema(verificationLink, query, log);
        
        if (!canary || !refresh) {
            log.error({
                refreshExists: refresh ? true : false,
                canaryExists: canary ? true : false 
                });
            throwError(log,event,'FORBIDDEN',401, "UnAuthorized", "Un Authorized",`Missing credentials`);
        }
        
      if ('valid' in validation) {
            log.error({...validation.errors}, 'Validation failed');
            throwError(log,event, 'INVALID_CREDENTIALS',400, "Invalid data", "Invalid data", `Validation failed`);
      }
        const {visitor, random, reason, temp } = validation.data;
        const cookies = [{label: 'canary_id', value: canary}, { label: 'session', value: refresh }];

      const res = await safeAction(refresh, async () => {
            return await sendToServer(false, `/auth/verify-custom-mfa/?visitor=${visitor}&temp=${encodeURIComponent(temp)}&random=${encodeURIComponent(random)}&reason=${reason}`, "GET", event, false, cookies)
        })

      if (!res) {
          throwError(log,event, "AUTH_SERVER_ERROR", 500, "Server Error", "Server error please try again later", 'Api Call Failed')
      }
      
      const results = await parseResponseContentType(log, res) as Results<{ link: string, reason: string }>
      
      if (res.ok && results.ok && res.status === 200) {
        const { link, reason } = results.data;
        log.info(`Link verified with a GET reqs. context is set.`);
        
        event.context.link = link
        event.context.reason = reason;
        return handler(event);
      }

        log.info( {...results},`link verification failed: invalid link`)
        throwError(log,event, "TEMPERING", res.status, "Server Error", "Server error please try again later", 'Failed magic link verification')
    }) 
  ) as EventHandler<T, Promise<D>>;
};