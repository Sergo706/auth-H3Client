import { defineHandler, EventHandler, H3Event, HTTPError } from "h3";
import pino from "pino";

type AppCode = 
'AUTH_REQUIRED' | 
 'SERVER_ERROR' | 
 'TEMPERING' | 
 'FORBIDDEN' | 
 'AUTH_SERVER_ERROR' | 
 'AUTH_CLIENT_ERROR' |
 'MISSING_BODY' |
 'INVALID_CREDENTIALS' |
 'INVALID_CONTENT_TYPE' |
 'NOT_FOUND'

export default function throwError(log: pino.Logger, event: H3Event, appCode: AppCode, status: number, statusText: string, message?: string, cause?: string): never {
      log.error({appCode, status, statusText, cause}, message)
       throw new HTTPError({
        body: { date: new Date().toJSON(), code: appCode },
        status,
        statusText,
        message,
       })
}