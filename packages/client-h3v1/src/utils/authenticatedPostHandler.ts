import { assertMethod, defineEventHandler, type EventHandler, type EventHandlerRequest } from 'h3';
import { defineAuthenticatedEventHandler, type MfaResponse } from './defineAuthRoute.js';
import { defineVerifiedCsrfHandler } from './csrfVerifier.js';

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