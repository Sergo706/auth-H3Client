import  verifyLink  from "../controllers/verifyTempLink.js";
import  sendCode  from "../controllers/sendMfaCode.js";
import csrfToken from "../middleware/csrf.js"
import  checkCsrf  from "../middleware/verifyCsrf.js";
import  { contentType }  from "../middleware/validateContentType.js";
import  initPasswordReset  from "../controllers/restartPasswordController.js";
import  sendNewPassword  from "../controllers/sendNewPassword.js";
import { defineHandler, H3 } from "h3";
import { limitBytes } from "../middleware/limitBytes.js";


const router = new H3();

const noStore = defineHandler((event) => {
  event.res.headers.set('Cache-Control', 'no-store')
})

router

.get("/auth/verify-mfa/:visitor", verifyLink,
    {middleware: [noStore, csrfToken]}
)
.post('/auth/verify-mfa/:visitor', sendCode, 
    {middleware: [verifyLink, checkCsrf, contentType('application/json'), limitBytes(1024)]}
);


router.post('/auth/password-reset',initPasswordReset,
    {middleware: [checkCsrf, contentType('application/json'), limitBytes(1024)]}
)


router

.get("/auth/reset-password/:visitor", verifyLink, 
    {middleware: [noStore, csrfToken]}
)

.post("/auth/reset-password/:visitor", sendNewPassword,
    {middleware: [verifyLink, checkCsrf, contentType('application/json'), limitBytes(1024)]}
)

export default router; 