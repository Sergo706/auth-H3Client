import { defineHandler, EventHandler } from 'h3'
import { getLogger } from '../utils/logger';
import throwError from './error';


export function contentType(expected: string): EventHandler {
    const log = getLogger().child({service: 'auth-client', branch: 'middleware', type: 'content-type'})
    return defineHandler((event) => {
        if (event.req.headers.get('content-type') !== expected) {
        throwError(log,event,'INVALID_CONTENT_TYPE', 403,'Forbidden', 'Not Allowed','unexpected content type')
        }
    })
  };