import { assertMethod, defineEventHandler, type EventHandler, type EventHandlerRequest } from 'h3';
import { defineAuthenticatedEventHandler, type MfaResponse } from './defineAuthRoute.js';
import { defineVerifiedCsrfHandler } from './csrfVerifier.js';

/**
 * Wraps an H3 event handler with authentication, CSRF verification, and POST method enforcement.
 * Combines `defineAuthenticatedEventHandler`, `defineVerifiedCsrfHandler`, and `assertMethod('POST')`.
 * Use this for secure POST endpoints that require authentication.
 * 
 * @template T - The event handler request type.
 * @template D - The expected return type of the handler.
 * @param handler - The H3 event handler to wrap.
 * @returns A wrapped handler requiring auth, CSRF, and POST method.
 * 
 * @example
 * // server/api/account/delete.post.ts
 * import { defineAuthenticatedEventPostHandlers } from 'auth-h3client';
 * 
 * export default defineAuthenticatedEventPostHandlers((event) => {
 *   return { deleted: true };
 * });
 */
export const defineAuthenticatedEventPostHandlers = <T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>
): EventHandler<T, Promise<D | MfaResponse>> => {
  
  return defineAuthenticatedEventHandler(
    defineVerifiedCsrfHandler(
      defineEventHandler((event) => {
        assertMethod(event, 'POST'); 
        return handler(event);
      })
    ) as EventHandler<T, D>
    );
};