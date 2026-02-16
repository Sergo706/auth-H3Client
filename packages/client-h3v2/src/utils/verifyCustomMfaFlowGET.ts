import { sendToServer } from "./serverToServer.js";
import { getLogger, parseResponseContentType, Results, safeAction } from "@internal/shared";
import { assertMethod, defineHandler, EventHandler, EventHandlerRequest, getCookie, getQuery } from "h3";
import throwError  from "../middleware/error.js";
import { VerificationLinkSchema, verificationLink } from "@internal/shared";
import { validateZodSchema } from "@internal/shared";
import type { CustomMfaFlowsVerificationResponse } from "@internal/shared";

/**
 * Creates an H3 event handler that verifies magic link parameters before executing
 * the provided handler. This is a higher-order function that wraps your handler
 * with magic link validation.
 *
 * **Note:** This handler does NOT verify CSRF tokens; it is intended for GET requests 
 * that verify a link signature and potentially seed a new CSRF token.
 *
 * The wrapper performs the following validations:
 * 1. Verifies the request method is GET
 * 2. Checks for required session cookies (`canary_id`, `session`)
 * 3. Validates query parameters against {@link VerificationLinkSchema}
 * 4. Verifies the magic link with the authentication server
 *
 * Upon successful verification, the handler receives an event with:
 * - `event.context.link` - The verified action link
 * - `event.context.reason` - The MFA flow reason identifier
 *
 * @typeParam T - The event handler request type
 * @typeParam D - The return type of the wrapped handler
 *
 * @param handler - The event handler to execute after successful verification
 *
 * @returns A wrapped event handler with magic link verification
 *
 * @example
 * ```typescript
 * export default defineVerifiedMagicLinkGetHandler(async (event) => {
 *   const { link, reason } = event.context;
 *   // Handle the verified magic link action
 *   return { success: true, action: reason };
 * });
 * ```
 *
 * @throws {H3Error} Throws HTTP errors for validation failures:
 *   - 401: Missing credentials
 *   - 400: Invalid query parameters
 *   - 500: Server communication errors
 */
export const defineVerifiedMagicLinkGetHandler = <T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>
): EventHandler<T, Promise<D>> => {
  return defineHandler(async (event) => {
        const log = getLogger().child({ service: 'auth-client', branch: 'custom-mfa', type: 'link-verifier' });
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
        const {visitor, random, reason, token } = validation.data;
        const cookies = [{label: 'canary_id', value: canary}, { label: 'session', value: refresh }];

      const res = await safeAction(refresh, async () => {
            return await sendToServer(false, `/auth/verify-custom-mfa/?visitor=${visitor}&token=${encodeURIComponent(token)}&random=${encodeURIComponent(random)}&reason=${reason}`, "GET", event, false, cookies)
        })

      if (!res) {
          throwError(log,event, "AUTH_SERVER_ERROR", 500, "Server Error", "Server error please try again later", 'Api Call Failed')
      }
      
      const results = await parseResponseContentType(log, res) as CustomMfaFlowsVerificationResponse;
      
      if (res.ok && results && 'ok' in results && results.ok && res.status === 200) {
        const { link, reason } = results.data;
        log.info(`Link verified with a GET reqs. context is set.`);
        
        event.context.link = link
        event.context.reason = reason;
        return handler(event);
      }

        log.info( {...results},`link verification failed: invalid link`)
        throwError(log,event, "TEMPERING", res.status, "Server Error", "Server error please try again later", 'Failed magic link verification')
    })  as EventHandler<T, Promise<D>>;
};