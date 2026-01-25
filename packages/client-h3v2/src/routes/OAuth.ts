import { H3 } from "h3";
import OAuthCallback from "../controllers/OAuthSuccessCallBack.js";
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
export function useOAuthRoutes(router: H3) {

router.get('/oauth/:provider', OAuthRedirect)

router.get('/oauth/callback/:provider', OAuthCallback, 
    {middleware: [OAuthTokensValidations]}
)
router.post('/oauth/callback/:provider', OAuthCallback, 
    {middleware: [OAuthTokensValidations]}
)

}
