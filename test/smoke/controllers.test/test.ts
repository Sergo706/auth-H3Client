import  attachAuthHeaders  from '../../../packages/client-h3v2/src/middleware/signatureMiddleware.js';
import  csrfToken  from '../../../packages/client-h3v2/src/middleware/csrf.js';
import { ensureAccessToken } from '../../../packages/client-h3v2/src/middleware/getAccessToken.js';
import { ensureRefreshCookie } from '../../../packages/client-h3v2/src/middleware/getRefreshToken.js';
import testController from "./testAuthController.js";
import { H3 } from 'h3';
import { ensureValidCredentials } from '../../../packages/client-h3v2/src/middleware/rotateTokens.js';



export function testApp(router: H3) {
    router.get(
        '/secret/data', testController,
        {middleware: [attachAuthHeaders, csrfToken, ensureRefreshCookie, ensureAccessToken,]}
    )
    
    router.get('/secret/data2', testController, 
        {middleware: [attachAuthHeaders, csrfToken, ensureValidCredentials]}
    )

}
export default testApp;