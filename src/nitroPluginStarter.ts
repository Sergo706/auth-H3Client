import { createApp, createRouter } from 'h3'
import  csrfToken  from './middleware/csrf.js';
import { configuration } from './config/config.js'
import {validator} from './middleware/visitorValid.js'
import isValidIP from './middleware/isValidIP.js'
import {httpLogger} from './middleware/httpLogger.js'
import {useAuthRoutes} from './routes/auth.js';
import {magicLinksRouter} from './routes/magicLinks.js';
import { useOAuthRoutes } from './routes/OAuth.js';
import type { Configuration }  from "./types/configSchema.js"
import { nitroShim } from './middleware/nitroShim.js';

export async function startService(config: Configuration) {
    configuration(config)
    console.log('auth called')
    const app = createApp();
    const router = createRouter();
    app.use(nitroShim);
    app.register(httpLogger());
    app.use(isValidIP)
    app.use(validator)
    app.use(csrfToken)

    useAuthRoutes(router)
    magicLinksRouter(router)
    useOAuthRoutes(router)

    app.get(`/test`, (event) => {
        event.res.status = 200
        return {msg: 'IT WORKS'}
    })

    return {
        handler: app.handler,
        fetchHandler: app.fetch,
        app: app
    };
}
