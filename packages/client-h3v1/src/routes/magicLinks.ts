import  verifyPasswordLink  from "../controllers/verifyTempPasswordResetLinks.js";
import  verifyMfaLink  from "../controllers/verifyMfaTempLink.js";
import  sendCode  from "../controllers/sendMfaCode.js";
import csrfToken from "../middleware/csrf.js"
import { verifyCsrfCookie as checkCsrf } from "../middleware/verifyCsrf.js";
import  { contentType }  from "../middleware/validateContentType.js";
import  initPasswordReset  from "../controllers/restartPasswordController.js";
import  sendNewPassword  from "../controllers/sendNewPassword.js";
import  initChangeEmailFlow  from "../controllers/initChangeEmailFlow.js";
import  changeEmailGetAPI  from "../controllers/changeEmailApi.js";
import  updateNewEmail  from "../controllers/sendNewEmailUpdate.js";
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
export function magicLinksRouter(router: Router, prefix?: string) {
  const p = (path: string) => prefix ? `/${prefix}${path}` : path;
  const verifyMfaGetPipeline = defineEventHandler(async (event) => {
      await noStore(event);
      await csrfToken(event);
      return verifyMfaLink(event);
  });
  router.get(p('/auth/verify-mfa'), verifyMfaGetPipeline);

  const verifyMfaPostPipeline = defineEventHandler(async (event) => {
      await verifyMfaLink(event); 
      await checkCsrf(event);
      await contentType('application/json')(event);
      await limitBytes(1024)(event);
      return sendCode(event);
  });
  router.post(p('/auth/verify-mfa'), verifyMfaPostPipeline);

  const initResetPipeline = defineEventHandler(async (event) => {
      await checkCsrf(event);
      await contentType('application/json')(event);
      await limitBytes(1024)(event);
      return initPasswordReset(event);
  });
  router.post(p('/auth/password-reset'), initResetPipeline);


const resetGetPipeline = defineEventHandler(async (event) => {
      await noStore(event);
      await csrfToken(event);
      return verifyPasswordLink(event);
  });
  router.get(p('/auth/reset-password'), resetGetPipeline);

const resetPostPipeline = defineEventHandler(async (event) => {
      await verifyPasswordLink(event); 
      await checkCsrf(event);
      await contentType('application/json')(event);
      await limitBytes(1024)(event);
      return sendNewPassword(event);
  });
  router.post(p('/auth/reset-password'), resetPostPipeline);

  router.post(p('/auth/change-email'), initChangeEmailFlow);
  
  const emailChangeGetPipeline = defineEventHandler(async (event) => {
      await noStore(event);
      await csrfToken(event); 
      return changeEmailGetAPI(event);
  });
  router.get(p('/auth/update-email'), emailChangeGetPipeline);

  router.post(p('/auth/update-email'), updateNewEmail);
}



export default magicLinksRouter; 
