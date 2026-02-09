import { sendToServer } from "./serverToServer.js";
import { assertMethod, defineHandler, EventHandler, EventHandlerRequest, getCookie, getQuery } from "h3";
import throwError  from "../middleware/error.js";
import { defineVerifiedCsrfHandler } from "./csrfVerifier.js";
import { limitBytes } from "../middleware/limitBytes.js";
import { applyRotationResult } from "./applyRotationResults.js";
import { getOperationalConfig } from "./getRemoteConfig.js";
import { type Code, type RotationResult, type VerificationLinkSchema, code, validateZodSchema, verificationLink, getLogger, safeAction } from "@internal/shared";
import { parseResponseContentType } from "@internal/shared";

/**
 * Creates an H3 event handler that verifies MFA codes before executing
 * the provided handler. This is a higher-order function that wraps your handler
 * with CSRF protection, body parsing, and MFA code validation.
 *
 * The wrapper performs the following validations:
 * 1. Verifies the request method is POST
 * 2. Validates CSRF token via {@link defineVerifiedCsrfHandler}
 * 3. Limits request body size to 8MB
 * 4. Checks for required session cookies (`canary_id`, `session`)
 * 5. Validates query parameters against {@link VerificationLinkSchema}
 * 6. Validates the MFA code from request body (7-digit numeric code)
 * 7. Verifies the code with the authentication server
 * 8. Applies token rotation on successful verification
 *
 * Upon successful verification, tokens are automatically rotated and the
 * handler receives the event with updated authentication context.
 *
 * @typeParam T - The event handler request type
 * @typeParam D - The return type of the wrapped handler
 *
 * @param handler - The event handler to execute after successful code verification
 *
 * @returns A wrapped event handler with MFA code verification
 *
 * @example
 * ```typescript
 * export default defineMfaCodeVerifierHandler(async (event) => {
 *   // MFA verified, tokens rotated - proceed with sensitive action
 *   await performSensitiveAction(event);
 *   return { success: true };
 * });
 * ```
 *
 * @throws {H3Error} Throws HTTP errors for validation failures:
 *   - 401: Missing credentials
 *   - 400: Invalid query parameters or MFA code
 *   - 500: Server communication errors
 *
 * @remarks
 * The MFA code must be provided in `event.context.body.code` as a 7-digit string.
 * This typically requires a body parser middleware to be applied beforehand.
 */
export const defineMfaCodeVerifierHandler = <T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>
): EventHandler<T, Promise<D>> => { 
      return defineVerifiedCsrfHandler(
        defineHandler(async (event) => { 
            const log = getLogger().child({ service: 'auth-client', branch: 'custom-mfa', type: 'code-verifier' });
            assertMethod(event, "POST")
            log.info('Verifying link...')

            await limitBytes(8000000)(event);
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

            const { code: providedCode } = event.context.body as Code;

            const codeValidation = validateZodSchema(code, { code: providedCode }, log);

            if ('valid' in codeValidation) {
                log.error({...codeValidation.errors}, 'Code Validation failed');
                throwError(log,event, 'INVALID_CREDENTIALS',400, "Invalid data", "Invalid data", `Validation failed`);
            }
            const validatedCode = codeValidation.data;

            const res = await safeAction(refresh, async () => {
                return await sendToServer(false, `/auth/verify-custom-mfa?visitor=${visitor}&temp=${encodeURIComponent(temp)}&random=${encodeURIComponent(random)}&reason=${reason}`, "POST", event, true, cookies, { code: validatedCode })
            })

            if (!res) {
                throwError(log,event, "AUTH_SERVER_ERROR", 500, "Server Error", "Server error please try again later", 'Api Call Failed')
            }
            const results = await parseResponseContentType(log, res) as { accessIat?: string; accessToken?: string }

            if (!res.ok || res.status !== 200) {
                log.warn({status: res.status, ...results}, "Invalid or expired code");
                throwError(log,event, "ERROR", 400, "Invalid code", "Invalid or expired code", 'Invalid or expired code')
            }

            const setCookies = res.headers.getSetCookie();
            const accessToken = results.accessToken;
            const accessIat = results.accessIat;

            if (setCookies.length === 0 || !accessIat || !accessToken) {
                throwError(log, event, 'AUTH_SERVER_ERROR', 500, 'Server Error','Something went wrong, please try restarting the page, and try again', `New refresh token and related cookies ended up null`);
             }
            const sessionLine = setCookies.find(c => c.trim().startsWith('session=')) ?? '';
            const sessionValue = sessionLine.split(';', 1)[0].split('=')[1]

             const mfaResults: RotationResult = {
                    type: 'both',
                    newToken: accessToken,
                    newRefresh: sessionValue,
                    accessIat: accessIat,
                    rawSetCookie: setCookies,
             }
             
             log.info({serverResponse: res, code: res.status},'MFA verification completed.');
             
             const { domain, accessTokenTTL } = await getOperationalConfig(event);
             applyRotationResult(event, mfaResults, domain, accessTokenTTL);
             return handler(event);
        })
    ) as EventHandler<T, Promise<D>>;
}