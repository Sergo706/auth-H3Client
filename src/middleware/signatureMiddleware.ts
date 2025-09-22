import { defineHandler, getRequestURL } from "h3";
import { signature } from "../utils/serverSignature.js";
import { getConfiguration } from "../config/config.js";
import { getLogger } from "../utils/logger.js";


export default defineHandler((event) => {
    const { server } = getConfiguration()
     const log = getLogger().child({server: 'auth-client', branch: 'Hmac', type: 'middleware'})
     const url = getRequestURL(event, {xForwardedHost: false, xForwardedProto: false})  
     
     const pathWithQuery = url.pathname + (url.search || '')
     const method = event.req.method || 'GET'

     const headers = signature(method, pathWithQuery)
     event.context.authHeaders = headers
     const baseSent = `${server.hmac.clientId}:${headers['X-Timestamp']}:${method}:${pathWithQuery}:${headers['X-Request-Id']}`;
     log.info(`[CLIENT] base = ${baseSent}`)
})