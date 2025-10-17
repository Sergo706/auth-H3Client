import { App, Router, setResponseStatus } from 'h3'
import  csrfToken  from './middleware/csrf.js';
import { configuration } from './config/config.js'
import {validator} from './middleware/visitorValid.js'
import isValidIP from './middleware/isValidIP.js'
import {httpLogger} from './middleware/httpLogger.js'
import {useAuthRoutes} from './routes/auth.js';
import {magicLinksRouter} from './routes/magicLinks.js';
import { useOAuthRoutes } from './routes/OAuth.js';
import type { Configuration }  from "./types/configSchema.js"


export async function startService(config: Configuration, app: App, router: Router) {
    try {
    configuration(config)
    console.log('auth called')

    httpLogger()(app)
    app.use(isValidIP)
    app.use(validator)
    app.use(csrfToken)
    
    useAuthRoutes(router)
    magicLinksRouter(router)
    useOAuthRoutes(router)

    router.get(`/test`, (event) => {
        setResponseStatus(event, 200)
        return {msg: 'IT WORKS'}
    })

    app.use(router)
    } catch (err) {
        throw err;
    }
}
