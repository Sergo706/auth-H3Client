import { defineHandler, type EventHandler, type EventHandlerRequest } from 'h3';
import { verifyCsrfCookie } from '../main.js';

/**
 * Wraps an H3 event handler with CSRF token verification.
 * Validates the `X-CSRF-Token` header against the session cookie before executing the handler.
 * Throws 403 if the CSRF token is invalid or missing.
 * 
 * @template T - The event handler request type.
 * @template D - The expected return type of the handler.
 * @param handler - The H3 event handler to wrap.
 * @returns A wrapped handler that requires valid CSRF token.
 * 
 * @example
 * // server/api/settings.post.ts
 * import { defineVerifiedCsrfHandler } from 'auth-h3client/v2';
 * 
 * export default defineVerifiedCsrfHandler((event) => {
 *   return { success: true };
 * });
 */
export const defineVerifiedCsrfHandler = <T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>
): EventHandler<T, Promise<D>> => {
  return defineHandler<T, Promise<D>>(async (event) => {
    await verifyCsrfCookie(event);
    return handler(event);
  });
};
