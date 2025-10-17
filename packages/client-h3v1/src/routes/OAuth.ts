import { Router } from "h3";
import { OAuthCallback } from "../controllers/OAuthSuccessCallBack.js";
import { OAuthTokensValidations } from '../middleware/OAuthCallBack.js';
import { OAuthRedirect } from "../controllers/OAuthRedirect.js";

/**
 * Registers OAuth initiation and callback routes for supported providers, ensuring
 * the callback response passes token validation middleware before invoking the controller.
 *
 * @param router - The H3 router used to register OAuth endpoints.
 * @returns void
 *
 * @example
 * import { createRouter } from 'h3';
 * import { useOAuthRoutes } from './routes/OAuth';
 *
 * const router = createRouter();
 * useOAuthRoutes(router);
 */
export function useOAuthRoutes(router: Router) {

router.get('/oauth/:provider', OAuthRedirect)

router.use('/oauth/callback/:provider', OAuthTokensValidations)
router.get('/oauth/callback/:provider', OAuthCallback)

}
