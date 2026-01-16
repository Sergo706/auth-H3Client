import { assertMethod, defineEventHandler, type EventHandler, type EventHandlerRequest } from 'h3';
import { defineAuthenticatedEventHandler, type MfaResponse } from './defineAuthRoute.js';
import { defineVerifiedCsrfHandler } from './csrfVerifier.js';
import type { Storage } from "unstorage";
import { CacheOptions } from "@internal/shared";

interface AuthOptions {
  storage: Storage;
  cache?: CacheOptions; 
}

export const defineAuthenticatedEventPostHandlers = <T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>, options: AuthOptions
): EventHandler<T, Promise<D | MfaResponse>> => {
  
  return defineAuthenticatedEventHandler(
    defineVerifiedCsrfHandler(
      defineEventHandler((event) => {
        assertMethod(event, 'POST'); 
        return handler(event);
      })
    ) as EventHandler<T, D>, 
    options 
    );
};