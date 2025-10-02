import { H3, serve } from 'h3'
import  csrfToken  from '../src/middleware/csrf.js';
import { configuration } from '../src/config/config.js'
import { config } from './config.test.js'
import {validator} from '../src/middleware/visitorValid.js'
import isValidIP from '../src/middleware/isValidIP.js'
import {httpLogger} from '../src/middleware/httpLogger.js'
import {useAuthRoutes} from '../src/routes/auth.js';
import {useStaticRoutes} from './controllers.test/static.js';
import {magicLinksRouter} from '../src/routes/magicLinks.js';
import {testApp} from './controllers.test/test.js';
import { OAuthCallback } from '../src/controllers/OAuthCallBack.js';
import { OAuthRedirect } from '../src/controllers/OAuthRedirect.js';

const app = new H3()
configuration(config)



app.register(httpLogger())
app.use(isValidIP)
app.use(validator)
app.use(csrfToken)
app.use((event) => {
  event.res.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; frame-src 'self'; img-src 'self' data:; connect-src 'self'")
})
app.get('/oauth/:provider', OAuthRedirect)
app.get('/oauth/callback/:provider', OAuthCallback)

useAuthRoutes(app)
magicLinksRouter(app)
testApp(app)
useStaticRoutes(app)


serve(app, { port: Number(process.env.PORT || 3000), hostname: process.env.HOST || '0.0.0.0' })
