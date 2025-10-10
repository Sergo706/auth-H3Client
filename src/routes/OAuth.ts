import { H3 } from "h3";
import { OAuthCallback } from "../controllers/OAuthSuccessCallBack.js";
import { OAuthTokensValidations } from '../middleware/OAuthCallBack.js';
import { OAuthRedirect } from "../controllers/OAuthRedirect.js";


export function useOAuthRoutes(router: H3) {

router.get('/oauth/:provider', OAuthRedirect)

router.get('/oauth/callback/:provider', OAuthCallback, 
    {middleware: [OAuthTokensValidations]}
)

}