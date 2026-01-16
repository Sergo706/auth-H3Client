import { defineEventHandler, type EventHandler, type EventHandlerRequest } from 'h3';
import { verifyCsrfCookie } from '../main.js';

export const defineVerifiedCsrfHandler = <T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>
): EventHandler<T, Promise<D>> => {
  return defineEventHandler<T, Promise<D>>(async (event) => {
    await verifyCsrfCookie(event);
    return handler(event);
  });
};
