import  attachAuthHeaders  from '../../src/middleware/signatureMiddleware.js';
import  csrfToken  from '../../src/middleware/csrf.js';
import { ensureAccessToken } from '../../src/middleware/getAccessToken.js';
import { ensureRefreshCookie } from '../../src/middleware/getRefreshToken.js';
import testController from "./testAuthController.js";
import { H3 } from 'h3';

const router = new H3()

router.get(
    '/secret/data', testController,
    {middleware: [attachAuthHeaders, csrfToken, ensureRefreshCookie, ensureAccessToken,]}
)

export default router;