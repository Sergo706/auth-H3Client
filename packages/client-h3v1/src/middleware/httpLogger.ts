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
  getRequestHost,
  getRequestFingerprint,
  App,
  getRequestHeader,
  setResponseHeader,
  getRequestHeaders,
  getResponseStatus,
  getResponseHeaders,
  getResponseStatusText,
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

/**
 * H3 plugin that attaches structured request/response logging, request IDs,
 * and error reporting using the shared Pino transport.
 *
 * @param app - H3 application instance to instrument.
 * @returns void
 *
 * @example
 * app.use(httpLogger);
 */
export const httpLogger = () => {
  return (app: App) => { 
          const prevOnRequest = app.options.onRequest;
          const prevOnAfterResponse = app.options.onAfterResponse;
          const prevOnError = app.options.onError;

  app.options.onRequest = async (event: H3Event) => {
      await prevOnRequest?.(event);

  const url = getRequestURL(event);
  const isAsset = url.pathname.match(/\.(css|js|png|jpe?g|svg|ico|woff2?|ttf|map|webp|json)$/i);
  const isDevTools = url.pathname.startsWith('/.well-known/');
  
  if (isAsset || isDevTools) {
      event.context.__skipLog = true
      return;
  };
  
  
  const incoming = getRequestHeader(event, 'x-request-id') ?? undefined
  let requestId = incoming || randomUUID()
  setResponseHeader(event, 'x-request-id', requestId)
  
  event.context.time = performance?.now?.() ?? Date.now();
  event.context.rid = requestId;
  
    const host = getRequestHost(event) || getRequestHeader(event, 'host') || '';
    const fullUrl = `${host}${url.pathname}${url.search || ''}`
    const ip = getRequestIP(event) || ''
    const ua = getRequestHeader(event, 'user-agent') || ''
    const fp = await getRequestFingerprint(event)
    const logger = httpLog;
  
    event.context.log = logger.child({
      requestId,
      httpRequest: {
        method: event.method,
        url: url.pathname + (url.search || ''),
        headers: getRequestHeaders(event),
        remoteAddress: ip,
  
      },
      ip,
      userAgent: ua,
      FullUrl: fullUrl,
      cookies: parseCookies(event),
      fingerPrints: fp,
      referrer:  getRequestHeader(event, 'referer') || undefined,
  
    });
    (event.context.log as pino.Logger).info('request start')
  };
  
  app.options.onAfterResponse = async (event: H3Event) => {
      await prevOnAfterResponse?.(event, undefined);
      if (event.context.__skipLog) return;
      const logger = httpLog;
  
       const log = (event.context.log as pino.Logger)  || logger;
       const ms = (performance.now() ?? Date.now()) - (event.context.time as number);

       const url = getRequestURL(event)
       const host = getRequestHost(event) || getRequestHeader(event, 'host') || '';
       const fullUrl = `${host}${url.pathname}`
       const status = getResponseStatus(event);
       const hasError = Boolean(event.context.error)
       
      let msg: string
  
      if (hasError) {
      const err = event.context.error as Error
      msg = `error: ${status} on ${event.method} ${url.pathname}${err?.message ? ` - ${err.message}` : ''}`
    } else {
        msg = status === 404
          ? `404 page hit. referer: ${getRequestHeader(event, 'referer') || 'N/A'}, latency: ${Math.round(ms)}ms`
          : `${event.method} ${fullUrl}${url.search || ''} completed`
    }

    const lvl = levelFor(status, hasError)
    const resHeaders = getResponseHeaders(event)
    const contentType = resHeaders['content-type']
    const contentLength = resHeaders['content-length'] ? Number(resHeaders['content-length']) : undefined


    log[lvl]({ 
      latencyMS: Math.round(ms),
      httpResponse: { 
           statusCode: status,
           statusText: getResponseStatusText(event),
           resHeaders,
           contentType,
           contentLength, 
          } 
      }, msg)
  
  };
  

    app.options.onError = async (error, event) => {
    event.context.error = error
    const logger = httpLog;

    const status = error.statusCode ?? (error as any).status;
    const statusText = (error as any).statusMessage ?? (error as any).statusText;
    const ms = (performance.now() ?? Date.now()) - (event.context.time as number);
    const log = (event.context.log as pino.Logger) || logger

    log.error(
      { httpError:
           { 
              latencyMS:  Math.round(ms),
              status,
              statusText,
              data: (error as any).data,
              name: error.name,
              message: error.message,
              stack: error.stack
           } }, 'http error')
          await prevOnError?.(error as any, event);
  }
  }
}

