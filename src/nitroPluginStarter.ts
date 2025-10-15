import { H3 } from 'h3'
import  csrfToken  from './middleware/csrf.js';
import { configuration } from './config/config.js'
import {validator} from './middleware/visitorValid.js'
import isValidIP from './middleware/isValidIP.js'
import {httpLogger} from './middleware/httpLogger.js'
import {useAuthRoutes} from './routes/auth.js';
import {magicLinksRouter} from './routes/magicLinks.js';
import { useOAuthRoutes } from './routes/OAuth.js';
import type { Configuration }  from "./types/configSchema.js"


export async function startService(app: H3, config: Configuration) {
    configuration(config)
    
    httpLogger()(app)
    app.use(isValidIP)
    app.use(validator)
    app.use(csrfToken)

    useAuthRoutes(app)
    magicLinksRouter(app)
    useOAuthRoutes(app)
}
