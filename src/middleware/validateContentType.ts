import { defineHandler, EventHandler, HTTPError } from 'h3'
import { getLogger } from '../utils/logger';


export function contentType(expected: string): EventHandler {
    const log = getLogger().child({service: 'auth-client', branch: 'middleware', type: 'content-type'})
    return defineHandler((event) => {
        if (event.req.headers.get('content-type') !== expected) {
            log.warn('unexpected content type');
            throw new HTTPError({
                body: { error: 'not allowed.' },
                status: 403,
                statusText: "Forbidden",
            });
        }
    })
  };