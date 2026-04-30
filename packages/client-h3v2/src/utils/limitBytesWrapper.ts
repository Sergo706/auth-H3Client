import { getLogger } from "@internal/shared";
import { assertMethod, defineHandler, EventHandler, EventHandlerRequest } from "h3";
import throwError from "../middleware/error.js";

export const defineByteLimiterHandler = <T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>,
  limitBytesTo: number,
  method: "POST" | "PUT" | "PATCH"
):  EventHandler<T, Promise<D> | D> => {
    return defineHandler(async (event) => {
        const log = getLogger().child({service: 'auth-client', branch: 'middleware', type: 'bytes-checker'})
        
        assertMethod(event, method)
        const header = event.req.headers?.get?.('Content-Length')
        
        if (header && Number.isFinite(+header) && +header > limitBytesTo) {
            throwError(log,event,'INVALID_CONTENT_TYPE',403, 'Forbidden', '', `exceeded allowed posts request bytes. Allowed: ${limitBytesTo}, Received: ${+header}. Request has been dropped`)
        }
        
        const rawBody = await event.req.arrayBuffer()
        const bytes = rawBody.byteLength

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