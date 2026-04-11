import { signature } from "@internal/shared";
import { clientHeaders } from './clientHeaders.js'
import { getAuthAgent } from "@internal/shared";
import { fetch } from 'undici'
import { getLogger } from "@internal/shared";
import type { H3Event } from 'h3'
import { getConfiguration } from "@internal/shared"; 
import { getBaseUrl } from "@internal/shared";
import type { Response } from 'undici'
type Cookie = { label: string; value: any };
type Cookies = Cookie | Cookie[];

/**
 * Sends a request to the auth server with client context headers, optional cookies,
 * and HMAC signatures, returning the upstream response.
 *
 * @typeParam T - Shape of the JSON payload being submitted.
 * @param keepAlive - Whether to use the high-concurrency agent for bot-detector traffic.
 * @param endpoint - Relative endpoint path to call on the auth server.
 * @param method - HTTP method to use.
 * @param event - H3 event providing request context for header propagation.
 * @param body - When true, serializes `data` as a JSON request body.
 * @param cookies - Cookies to forward to the auth server.
 * @param data - Optional JSON body payload.
 * @param token - Optional bearer token injected as `Authorization`.
 * @returns Upstream `Response` or `void` when the fetch fails before receiving a response.
 *
 * @example
 * const res = await sendToServer(true, '/auth/login', 'POST', event, true, cookies, payload);
 */
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
      Endpoint: endpoint,
      Method: method,
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

  log.debug({      
      cookies: cookies,
      body: body,
      data: data,
    }, '[DEBUG]'
  )
  log.info(`Mapped. About to fetch`)
  const signal = AbortSignal.timeout(15000)
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
