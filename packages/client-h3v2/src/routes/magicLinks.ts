import  verifyLink  from "../controllers/verifyTempLink.js";
import  sendCode  from "../controllers/sendMfaCode.js";
import csrfToken from "../middleware/csrf.js"
import  checkCsrf  from "../middleware/verifyCsrf.js";
import  { contentType }  from "../middleware/validateContentType.js";
import  initPasswordReset  from "../controllers/restartPasswordController.js";
import  sendNewPassword  from "../controllers/sendNewPassword.js";
import { defineHandler, H3 } from "h3";
import { limitBytes } from "../middleware/limitBytes.js";



const noStore = defineHandler((event) => {
  event.res.headers.set('Cache-Control', 'no-store')
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
export function magicLinksRouter(router: H3, prefix?: string) {
    const p = (path: string) => prefix ? `/${prefix}${path}` : path;

    router

    .get(p("/auth/verify-mfa/:visitor"), verifyLink,
        {middleware: [noStore, csrfToken]}
    )
    .post(p('/auth/verify-mfa/:visitor'), sendCode, 
        {middleware: [verifyLink, checkCsrf, contentType('application/json'), limitBytes(1024)]}
    );


    router.post(p('/auth/password-reset'),initPasswordReset,
        {middleware: [checkCsrf, contentType('application/json'), limitBytes(1024)]}
    )


    router
    
    .get(p("/auth/reset-password/:visitor"), verifyLink, 
        {middleware: [noStore, csrfToken]}
    )
    
    .post(p("/auth/reset-password/:visitor"), sendNewPassword,
        {middleware: [verifyLink, checkCsrf, contentType('application/json'), limitBytes(1024)]}
    )

}






export default magicLinksRouter; 
