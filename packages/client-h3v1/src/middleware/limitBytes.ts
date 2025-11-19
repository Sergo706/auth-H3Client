import { assertMethod, defineEventHandler, EventHandler, getHeader, readRawBody } from "h3";
import throwError from "./error.js";
import { getLogger } from "../utils/logger.js";


/**
 * Middleware factory that enforces maximum request body size for POST requests
 * and parses JSON payloads into the request context.
 *
 * @param maxBytes - Maximum accepted payload size in bytes.
 * @returns H3 event handler enforcing the size limit and JSON parsing.
 *
 * @example
 * router.post('/endpoint', handler, { middleware: [limitBytes(1024)] });
 */
export function limitBytes(maxBytes: number): EventHandler {
    const log = getLogger().child({service: 'auth-client', branch: 'middleware', type: 'bytes-checker'})
    return defineEventHandler( async (event) => {
        assertMethod(event, "POST")
     const header = getHeader(event, 'Content-Length')
    
     if (header && Number.isFinite(+header) && +header > maxBytes) {
        throwError(log,event,'INVALID_CONTENT_TYPE',403, 'Forbidden', '', `exceeded allowed posts request bytes. Allowed: ${maxBytes}, Received: ${+header}. Request has been dropped`)
     }
     const raw = await readRawBody(event, false)
        console.log("RAW" ,raw);

     const rawBody = typeof raw === 'string' ? Buffer.from(raw, 'utf8') : raw;
        console.log(`RAWBODY`, rawBody);

     const bytes = rawBody?.byteLength ?? 0
        console.log(bytes);

      if (bytes === 0) { 
        event.context.body = undefined; 
        return; 
      }

      if (bytes > maxBytes) {
        throwError(log,event,'INVALID_CONTENT_TYPE',403, 'Forbidden', '', `exceeded allowed posts request bytes. Allowed: ${maxBytes}, Received: ${bytes}. Request has been dropped`)
      }
      try {
          event.context.body = await JSON.parse(new TextDecoder().decode(rawBody))
      } catch(err) {
        throwError(log,event,'INVALID_CONTENT_TYPE',400,'Invalid input','','Error parsing body')
      }
    })
}
