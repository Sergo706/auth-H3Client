import { getLogger, type UtilsResponse } from '@internal/shared'
import { defineVerifiedMagicLinkGetHandler } from '../utils/verifyCustomMfaFlowGET.js';
import throwHttpError from '../middleware/error.js';
import { assertMethod } from 'h3'

export interface SuccessPath {
    reason: 'change_email',
    link: "Password Reset" | "MFA Code" | 'Custom MFA'; 
}
/**
 * Verifies the validity of an email change magic link.
 * 
 * This controller:
 * 1. Is wrapped by `defineVerifiedMagicLinkGetHandler` which validates the link signature.
 * 2. Checks that the verified context contains valid `reason` ('change_email') and `link` data.
 * 
 * It is primarily used as a GET endpoint when the user clicks the link in their email.
 * 
 * @param event - The H3 event object, populated with verified `context` data.
 * @returns A promise resolving to a `UtilsResponse` with the operation reason, confirming validity.
 * 
 * @throws {H3Error} Throws HTTP 401 if the link context is invalid or missing.
 */
export default defineVerifiedMagicLinkGetHandler(async (event): Promise<UtilsResponse<SuccessPath>> => {

    const log = getLogger().child({service: 'auth-client', branch: 'email-change-api'})
    assertMethod(event, "GET")

    const meta = event.context;

    if (!meta.link || !meta.reason || meta.reason !== 'change_email') {
        throwHttpError(log,event,'MFA_FAILED',401,'UnAuthorized', 'Un Authorized action',`
        Un Authorized action detected.`);
    }
    log.info("Entered magic link for email change");

    return {
      ok: true,
      date: new Date().toISOString(),
      data: {
        link: meta.link as any,
        reason: meta.reason
      }
    };
  });