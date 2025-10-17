import  verifyLink  from "../controllers/verifyTempLink.js";
import  sendCode  from "../controllers/sendMfaCode.js";
import csrfToken from "../middleware/csrf.js"
import  checkCsrf  from "../middleware/verifyCsrf.js";
import  { contentType }  from "../middleware/validateContentType.js";
import  initPasswordReset  from "../controllers/restartPasswordController.js";
import  sendNewPassword  from "../controllers/sendNewPassword.js";
import { defineEventHandler, isMethod, Router, setHeader } from "h3";
import { limitBytes } from "../middleware/limitBytes.js";


const only = (method: 'GET' | 'POST') => 
    defineEventHandler((event) => { 
        if (!isMethod(event, method)) return 
    })
    
const noStore = defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'no-store')
})

/**
 * Attaches magic-link, MFA verification, and password reset routes to the provided router.
 * Routes ensure proper caching headers, CSRF verification, and payload validation while
 * delegating business logic to the respective controllers.
 *
 * @param router - The H3 router that receives the MFA and password-reset routes.
 * @returns void
 *
 * @example
 * import { createRouter } from 'h3';
 * import { magicLinksRouter } from './routes/magicLinks';
 *
 * const router = createRouter();
 * magicLinksRouter(router);
 */
export function magicLinksRouter(router: Router) {
  router.use('/auth/verify-mfa/:visitor', only('GET'))
  router.use('/auth/verify-mfa/:visitor', noStore)
  router.use('/auth/verify-mfa/:visitor', csrfToken)
  router.get('/auth/verify-mfa/:visitor', verifyLink)
  
  router.use('/auth/verify-mfa/:visitor', only('POST'))
  router.use('/auth/verify-mfa/:visitor', verifyLink)
  router.use('/auth/verify-mfa/:visitor', checkCsrf)
  router.use('/auth/verify-mfa/:visitor', contentType('application/json'))
  router.use('/auth/verify-mfa/:visitor', limitBytes(1024))
  router.post('/auth/verify-mfa/:visitor', sendCode)


  router.use('/auth/password-reset', only('POST'))
  router.use('/auth/password-reset', checkCsrf)
  router.use('/auth/password-reset', contentType('application/json'))
  router.use('/auth/password-reset', limitBytes(1024))
  router.post('/auth/password-reset', initPasswordReset)


  router.use('/auth/reset-password/:visitor', only('GET'))
  router.use('/auth/reset-password/:visitor', noStore)
  router.use('/auth/reset-password/:visitor', csrfToken)
  router.get('/auth/reset-password/:visitor', verifyLink)

  router.use('/auth/reset-password/:visitor', only('POST'))
  router.use('/auth/reset-password/:visitor', verifyLink)
  router.use('/auth/reset-password/:visitor', checkCsrf)
  router.use('/auth/reset-password/:visitor', contentType('application/json'))
  router.use('/auth/reset-password/:visitor', limitBytes(1024))
  router.post('/auth/reset-password/:visitor', sendNewPassword)

}



export default magicLinksRouter; 
