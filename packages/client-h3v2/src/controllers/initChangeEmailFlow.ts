import { initSchema, getLogger, type InitSchemaType, type UtilsResponse, validateZodSchema } from '@internal/shared'
import { askForMfaFlow, defineVerifiedCsrfHandler, limitBytes, throwHttpError } from '../main.js'
import { assertMethod } from 'h3'
import crypto from 'node:crypto'


/**
 * Initiates the email change flow for an authenticated user.
 * 
 * This controller:
 * 1. Validates the user's session and `Content-Type`.
 * 2. Validates the request body against `initSchema`.
 * 3. Generates a secure random 128-byte token.
 * 4. Calls `askForMfaFlow` to send a verification email to the user's *current* email address.
 * 
 * @param event - The H3 event object containing the request.
 * @returns A promise resolving to a `UtilsResponse` indicating success or failure.
 *          If MFA is required, it returns a 202 Accepted response with `code: "MFA_REQUIRED"`.
 * 
 * @throws {H3Error} Throws HTTP errors for:
 * - 400: Invalid Content-Type or Validation Failed.
 * - 401: Unauthorized (if session is invalid, though handled by wrapper).
 * - 500: Unexpected server errors.
 */
export default defineVerifiedCsrfHandler(async (event): Promise<UtilsResponse<string>> => {

  const log = getLogger().child({service: 'auth-client', branch: 'email-change'})
  assertMethod(event, "POST")
  await limitBytes(1000000)(event);

  const contentType = event.req.headers.get('Content-Type');


  if (!contentType || contentType !== 'application/json') {
    throwHttpError(log, event, 'INVALID_CONTENT_TYPE', 400, 'Invalid Content-Type', 'Content-Type must be application/json', `Received: ${contentType}`);
  };
  const body = event.context.body as InitSchemaType;
  const validation = validateZodSchema(initSchema, body, log);

  if ('valid' in validation) {
        log.error({...validation.errors}, 'Validation failed');
        throwHttpError(log,event, 'INVALID_CREDENTIALS',400, "Invalid data", "Invalid data", `Validation failed`);
  }

  const random = crypto.randomBytes(128).toString('hex');

  try {
    const res = await askForMfaFlow(event, log, 'change_email', random);

    if (!res.ok && res.code !== "MFA_REQUIRED") return res;
    
    if (!res.ok && res.code === "MFA_REQUIRED") {
      return {
        ...res,
        reason: "Please verify its you. check your email address."
      }
    }

    return res;
  } catch(err) {
    log.error({ err }, "Unexpected error in ChangeEmail controller");
    return {
      ok: false,
      date: new Date().toISOString(),
      reason: 'Something went wrong, please try restarting the page, and try again',
      code: 'UNEXPECTED_ERROR'
    }
  }
})