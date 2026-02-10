import { H3, serve } from 'h3'
import  csrfToken  from '../packages/client-h3v2/src/middleware/csrf.js';
import { configuration } from '@internal/shared'
import { config } from './setup/configs/config.js'
import {validator} from '../packages/client-h3v2/src/middleware/visitorValid.js'
import isValidIP from '../packages/client-h3v2/src/middleware/isValidIP.js'
import {httpLogger} from '../packages/client-h3v2/src/middleware/httpLogger.js'
import {useAuthRoutes} from '../packages/client-h3v2/src/routes/auth.js';
import {useStaticRoutes} from './smoke/controllers.test/static.js';
import {magicLinksRouter} from '../packages/client-h3v2/src/routes/magicLinks.js';
import {testApp} from './smoke/controllers.test/test.js';
import { useOAuthRoutes } from '../packages/client-h3v2/src/routes/OAuth.js';
const app = new H3()
configuration(config)


app.register(httpLogger())
app.use(isValidIP)
app.use(validator)
app.use(csrfToken)
app.use((event) => {
  event.res.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; frame-src 'self'; img-src 'self' data:; connect-src 'self'")
})

useAuthRoutes(app)
magicLinksRouter(app)
testApp(app)
useStaticRoutes(app)
useOAuthRoutes(app)

serve(app, { 
  port: Number(process.env.PORT || 3000), 
  hostname: process.env.HOST || '0.0.0.0',
  tls: { cert: "./share-ad1ae22.com+2.pem", key: "./share-ad1ae22.com+2-key.pem" }, 
})
