import { getLogger } from "@internal/shared";
import { assertMethod, defineEventHandler, EventHandler, EventHandlerRequest, getHeader, readRawBody } from "h3";
import throwError from "../middleware/error.js";

export const defineByteLimiterHandler = <T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>,
  limitBytesTo: number,
  method: "POST" | "PUT" | "PATCH"
):  EventHandler<T, Promise<D> | D> => {
    return defineEventHandler(async (event) => {
        const log = getLogger().child({service: 'auth-client', branch: 'middleware', type: 'bytes-checker'})

        assertMethod(event, method)
        const header = getHeader(event, 'Content-Length')
        
         if (header && Number.isFinite(+header) && +header > limitBytesTo) {
            throwError(log,event,'INVALID_CONTENT_TYPE',403, 'Forbidden', '', `exceeded allowed posts request bytes. Allowed: ${limitBytesTo}, Received: ${+header}. Request has been dropped`)
         }
         const raw = await readRawBody(event, false)
    
         const rawBody = typeof raw === 'string' ? Buffer.from(raw, 'utf8') : raw;
    
         const bytes = rawBody?.byteLength ?? 0
    
          if (bytes === 0) { 
            event.context.body = undefined; 
            return handler(event);
          }
    
          if (bytes > limitBytesTo) {
            throwError(log,event,'INVALID_CONTENT_TYPE',403, 'Forbidden', '', `exceeded allowed posts request bytes. Allowed: ${limitBytesTo}, Received: ${bytes}. Request has been dropped`)
          }
          
          try {
              event.context.body = await JSON.parse(new TextDecoder().decode(rawBody))
          } catch(err) {
            throwError(log,event,'INVALID_CONTENT_TYPE',400,'Invalid input','','Error parsing body')
          }
        return handler(event)
    }) as EventHandler<T, Promise<D> | D>
}