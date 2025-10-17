import { defineHandler, EventHandler } from 'h3'
import { getLogger } from '../utils/logger.js';
import throwError from './error.js';


/**
 * Middleware factory ensuring requests present the expected Content-Type header.
 *
 * @param expected - The MIME type required for the request.
 * @returns H3 event handler that enforces the header requirement.
 *
 * @example
 * router.post('/signup', handler, { middleware: [contentType('application/json')] });
 */
export function contentType(expected: string): EventHandler {
    const log = getLogger().child({service: 'auth-client', branch: 'middleware', type: 'content-type'})
    return defineHandler((event) => {
        if (event.req.headers.get('content-type') !== expected) {
        throwError(log,event,'INVALID_CONTENT_TYPE', 403,'Forbidden', 'Not Allowed','unexpected content type')
        }
    })
  };
