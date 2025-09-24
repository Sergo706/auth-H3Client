import signup from "../controllers/handleSignUps.js";
import { contentType } from "../middleware/validateContentType.js";
import checkCsrf from "../middleware/verifyCsrf.js"
import  login  from "../controllers/handleLogin.js";

import { H3 } from "h3";
import { limitBytes } from "../middleware/limitBytes.js";

const router = new H3();


router.post('/signup', signup,
  { middleware: [checkCsrf, contentType('application/json'), limitBytes(1024)] },
)

router.post('/login', login,
{middleware: [checkCsrf, contentType('application/json'), limitBytes(1024)]}
)

export default router

