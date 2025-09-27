import pino, { Level } from 'pino';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { 
  H3Event, 
  getRequestURL,
  getRequestIP,
  parseCookies,
  onRequest,
  getRequestHost,
  getRequestFingerprint,
  onResponse,
  onError,
  defineHandler
} from 'h3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const LOG_DIR = path.resolve(__dirname, '..', '..', 'logs');
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

const transport = pino.transport({  
  targets: [
    {
      target: 'pino/file',
      level:  'info',
      options: {
        destination: `${LOG_DIR}/http.log`,
        mkdir: true,
      },
    }
  ]
});

export const httpLog = pino(
  {
    level: 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin() { return { uptime: process.uptime() }; },
    redact: {
      paths: ['httpRequest.headers.authorization', 'httpRequest.headers.cookie'],
      censor: '[SECRET]'
    }
  },
  transport
);

function levelFor(status: number, hasError: boolean): Level {
  if (hasError || status >= 500) return 'error'
  if (status >= 400) return 'warn'
  if (status >= 300) return 'info'
  return 'info'
}

export const httpLogger = (event: H3Event) => {

    onRequest((event) => {
    const url = getRequestURL(event);
    const isAsset = url.pathname.match(/\.(css|js|png|jpe?g|svg|ico|woff2?|ttf|map|webp|json)$/i);
    const isDevTools = url.pathname.startsWith('/.well-known/');

    if (isAsset || isDevTools) {
        event.context.__skipLog = true
        return;
    };

    
    const incoming = event.req.headers.get('x-request-id') ?? undefined
    let requestId = incoming || randomUUID()
    event.res.headers.set('x-request-id', requestId)
    
    event.context.time = performance?.now?.() ?? Date.now();
    event.context.rid = requestId;

      const host = getRequestHost(event) || event.req.headers.get('host') || '';
      const fullUrl = `${host}${url.pathname}${url.search || ''}`
      const ip = getRequestIP(event) || ''
      const ua = event.req.headers.get('user-agent') || ''
      const fp = getRequestFingerprint(event)
      const logger = httpLog;

      event.context.log = logger.child({
        requestId,
        httpRequest: {
          method: event.req.method,
          url: url.pathname + (url.search || ''),
          headers: Object.fromEntries(event.req.headers),
          remoteAddress: ip,

        },
        ip,
        userAgent: ua,
        FullUrl: fullUrl,
        cookies: parseCookies(event),
        fingerPrints: fp,
        referrer: event.req.referrer,

      })
      logger.info('request start')
    }),

    onResponse((res: Response, event: H3Event) => {
      const logger = httpLog;

         if (event.context.__skipLog) return;
         const log = (event.context.log as pino.Logger)  || logger;
         const ms = (performance.now() ?? Date.now()) - (event.context.time as number);
         const rid = String(event.context.rid)
         const status = res.status;
         const hasError = Boolean(event.context.error)
         
         if (rid) event.res.headers.set('x-request-id', rid);
        const url = getRequestURL(event)
        const host = getRequestHost(event) || event.req.headers.get('host') || '';
        const fullUrl = `${host}${url.pathname}`
        let msg: string

        if (hasError) {
        const err = event.context.error as Error
        msg = `error: ${status} on ${event.req.method} ${url.pathname}${err?.message ? ` - ${err.message}` : ''}`
      } else {
          msg = status === 404
            ? `404 page hit. referer: ${event.req.headers.get('referer') || 'N/A'}, latency: ${Math.round(ms)}ms`
            : `${event.req.method} ${fullUrl}${url.search || ''} completed`
      }

      const lvl = levelFor(status, hasError)
      log[lvl]({ 
        latency: Math.round(ms),
        httpResponse: { 
             statusCode: status,
             headers: res.headers ,
             url: res.url,
             type: res.type,
             a: res.bodyUsed
            } 
        }, msg)

    }),

    onError((error, event) => {
      const logger = httpLog;
      
      event.context.error = error
      const ms = (performance.now() ?? Date.now()) - (event.context.time as number);
      const log = (event.context.log as pino.Logger) || logger
      log.error(
        { httpError:
             { 
                latency:  Math.round(ms),
                status: error.status,
                statusText: error.statusText,
                body: error.body,
                data: error.data,
                name: error.name,
                message: error.message,
                stack: error.stack
             } }, 'http error')
    })
}
