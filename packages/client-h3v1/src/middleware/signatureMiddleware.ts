import { defineEventHandler, getRequestURL } from "h3";
import { signature } from "../utils/serverSignature.js";
import { getConfiguration } from "../config/config.js";
import { getLogger } from "../utils/logger.js";


/**
 * Generates signed headers for outbound server-to-server calls and stores them on the request context.
 *
 * @param event - H3 event whose request information seeds the signature.
 * @returns void
 *
 * @example
 * router.use(signatureMiddleware);
 */
export default defineEventHandler((event) => {
    const { server } = getConfiguration()
     const log = getLogger().child({server: 'auth-client', branch: 'Hmac', type: 'middleware'})
     const url = getRequestURL(event, {xForwardedHost: false, xForwardedProto: false})  
     
     const pathWithQuery = url.pathname + (url.search || '')
     const method = event.method || 'GET'

     const headers = signature(method, pathWithQuery)
     event.context.authHeaders = headers
     const baseSent = `${server.hmac.clientId}:${headers['X-Timestamp']}:${method}:${pathWithQuery}:${headers['X-Request-Id']}`;
     log.info(`[CLIENT] base = ${baseSent}`)
})
