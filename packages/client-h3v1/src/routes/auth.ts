import signup from "../controllers/handleSignUps.js";
import { contentType } from "../middleware/validateContentType.js";
import { verifyCsrfCookie as checkCsrf } from "../middleware/verifyCsrf.js"
import  login  from "../controllers/handleLogin.js";
import handleLogout  from "../controllers/handleLogout.js";
import { defineEventHandler, Router } from "h3";
import { limitBytes } from "../middleware/limitBytes.js";

/**
 * Registers core authentication routes on the given H3 router, including login, signup,
 * logout, and a simple test endpoint. Each route wires the appropriate controller and
 * middleware required for CSRF protection, content validation, and payload limits.
 *
 * @param router - The H3 router instance to attach auth endpoints to.
 * @returns void
 *
 * @example
 * import { createRouter } from 'h3';
 * import { useAuthRoutes } from './routes/auth';
 *
 * const router = createRouter();
 * useAuthRoutes(router);
 */
export function useAuthRoutes(router: Router) {

  const signUpPipeline = defineEventHandler(async (event) => {
    await checkCsrf(event);
    await contentType('application/json')(event);
    await limitBytes(1024)(event);
    return signup(event);
  })

  router.post('/signup', signUpPipeline);

  const loginPipeline = defineEventHandler(async (event) => {
      await checkCsrf(event);
      await contentType('application/json')(event);
      await limitBytes(1024)(event);
      return login(event);
  });

  router.post('/login', loginPipeline);

  const logoutPipeline = defineEventHandler(async (event) => {
      await checkCsrf(event);
      await limitBytes(0)(event);
      return handleLogout(event);
  })

  router.post('/logout', logoutPipeline)
}

export default useAuthRoutes
