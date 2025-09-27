import { H3, HTTPError, serve } from 'h3'

import { configuration } from '../src/config/config.js'
import { config } from './config.test.js'
import {validator} from '../src/middleware/visitorValid.js'
import isValidIP from '../src/middleware/isValidIP.js'
import {httpLogger} from '../src/middleware/httpLogger.js'

const app = new H3()
configuration(config)
const [{ default: staticApp }, { default: testApp }, { default: authApp }, { default: magicApp }, { default: OAuthRedirect }, { default: OAuthCallback }] = await Promise.all([
  import('./controllers.test/static.js'),
  import('./controllers.test/test.js'),
  import('../src/routes/auth.js'),
  import('../src/routes/magicLinks.js'),
  import('../src/controllers/OAuthRedirect.js'),
  import('../src/controllers/OAuthCallBack.js'),
])


app.use(httpLogger)
app.use(isValidIP)
app.use(validator)
app.mount('/', staticApp)
app.get('/oauth/:provider', OAuthRedirect)
app.get('/oauth/callback/:provider', OAuthCallback)
app.mount('/', magicApp) 
app.mount('/', authApp)
app.mount('/', testApp)


serve(app, { port: Number(process.env.PORT || 3000), hostname: process.env.HOST || '0.0.0.0' })
