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

  const verifyMfaGetPipeline = defineEventHandler(async (event) => {
      await noStore(event);
      await csrfToken(event);
      return verifyLink(event);
  });
  router.get('/auth/verify-mfa/:visitor', verifyMfaGetPipeline);

  const verifyMfaPostPipeline = defineEventHandler(async (event) => {
      await verifyLink(event); 
      await checkCsrf(event);
      await contentType('application/json')(event);
      await limitBytes(1024)(event);
      return sendCode(event);
  });
  router.post('/auth/verify-mfa/:visitor', verifyMfaPostPipeline);

  const initResetPipeline = defineEventHandler(async (event) => {
      await checkCsrf(event);
      await contentType('application/json')(event);
      await limitBytes(1024)(event);
      return initPasswordReset(event);
  });
  router.post('/auth/password-reset', initResetPipeline);


const resetGetPipeline = defineEventHandler(async (event) => {
      await noStore(event);
      await csrfToken(event);
      return verifyLink(event);
  });
  router.get('/auth/reset-password/:visitor', resetGetPipeline);

const resetPostPipeline = defineEventHandler(async (event) => {
      await verifyLink(event); 
      await checkCsrf(event);
      await contentType('application/json')(event);
      await limitBytes(1024)(event);
      return sendNewPassword(event);
  });
  router.post('/auth/reset-password/:visitor', resetPostPipeline);

}



export default magicLinksRouter; 
