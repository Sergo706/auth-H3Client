import signup from "../controllers/handleSignUps.js";
import { contentType } from "../middleware/validateContentType.js";
import checkCsrf from "../middleware/verifyCsrf.js"
import  login  from "../controllers/handleLogin.js";
import { handleLogout } from "../controllers/handleLogout.js";
import { Router } from "h3";
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

  router.use('/signup', checkCsrf)
  router.use('/signup', contentType('application/json'))
  router.use('/signup', limitBytes(1024))
  router.post('/signup', signup)

  router.use('/logout', checkCsrf)
  router.use('/logout', limitBytes(0))
  router.post('/logout', handleLogout)

  router.use('/login', checkCsrf)
  router.use('/login', contentType('application/json'))
  router.use('/login', limitBytes(1024))
  router.post('/login', login)

}

export default useAuthRoutes
