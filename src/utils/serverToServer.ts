import { signature } from './serverSignature.js'
import { clientHeaders } from './clientHeaders.js'
import { getAuthAgent } from './serverAuth.js'
import { fetch } from 'undici'
import { getLogger } from './logger.js'
import type { H3Event } from 'h3'
import { getConfiguration } from '../config/config.js' 


type Cookie = { label: string; value: any };
type Cookies = Cookie | Cookie[];

export async function sendToServer<T>(endpoint: string, method: string, event: H3Event, body: boolean, cookies?: Cookies, data?: object) {
    const config = getConfiguration()
    const agent = getAuthAgent()
    const logger = getLogger()
     const serverIP = config.server.auth_location.serverOrDNS;
     const API_URL = `${config.server.ssl.enableSSL ? 'https://' : 'http://'}${serverIP}`;

    let identifiers: string | undefined;
    const log = logger.child({service: 'utils', type: `BFF TO API`, cookies: cookies, Endpoint: endpoint, Method: method, body: body, data: data})
    log.info(`Mapping cookies and headers...`)
    
    if (cookies) { 
    if (Array.isArray(cookies) && cookies.length > 0) {
        identifiers = cookies.map(id => `${id.label}=${id.value}`).join('; ');
    } else if (!Array.isArray(cookies) && cookies.label && cookies.value) {
        identifiers = `${cookies.label}=${cookies.value}`;
    }
   } 

  const authHeaders = config.server.hmac.enableHmac ? signature(method, endpoint) : undefined;

    
  const headers: Record<string, string | undefined> = {
    ...authHeaders,
    ...clientHeaders(event),
    Cookie: identifiers,
    'authorization': `Bearer ${endpoint}`,
  };

    if (body) {
    headers['Content-Type'] = 'application/json';
  }

  log.info(`Mapped. sending Request`)

try { 
   const response = await fetch(`${API_URL}${endpoint}`, {
         method: method,
         body: body ? JSON.stringify(data) : undefined,
         headers: headers,
         dispatcher: agent
    });
     log.info({code: response.status, data: response}, `Request succeeded.`)
      return response;
    } catch(err) {
      log.fatal({ err }, `Request failed.`)
      return
    }
    
}