import { signature } from './serverSignature.js'
import { clientHeaders } from './clientHeaders.js'
import { getAuthAgent } from './serverAuth.js'
import { fetch } from 'undici'
import { getLogger } from './logger.js'
import type { H3Event } from 'h3'
import { getConfiguration } from '../config/config.js' 
import { getBaseUrl } from './buildBaseUrl.js'
import { parseResponseContentType } from './checkResponseType.js'
import type { Response } from 'undici'
type Cookie = { label: string; value: any };
type Cookies = Cookie | Cookie[];

export async function sendToServer<T>(keepAlive: boolean, endpoint: string, method: string, event: H3Event, body: boolean, cookies?: Cookies, data?: object, token?: string): Promise<Response|void> {
    const config = getConfiguration()
    const agent = getAuthAgent(keepAlive)
    const logger = getLogger()
    const url = getBaseUrl(config)
    const targetURL = new URL(endpoint, url);

    let identifiers: string | undefined;

    const log = logger.child({
      service: 'utils',
      type: `BFF TO API`,
      cookies: cookies,
      Endpoint: endpoint,
      Method: method,
      body: body,
      data: data,
      targetURL: targetURL.href,
      protocol: targetURL.protocol,
      host: targetURL.host,
    })
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
    Accept: 'application/json'
  };
  
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  log.info(`Mapped. About to fetch`)
  const signal = AbortSignal.timeout(3000)
try { 
   const response = await fetch(targetURL, {
         method: method,
         body: body ? JSON.stringify(data) : undefined,
         headers: headers,
         dispatcher: agent,
         signal
    });

    if (!response.ok || response.status >= 399) {
      log.error({code: response.status, data: response}, `Request failed.`)
      return response;
    }

      log.info({code: response.status, data: response}, `Request succeeded.`)
      return response;
    } catch(err) {
      log.fatal({ err }, `Request failed.`)
      return;
    }
}