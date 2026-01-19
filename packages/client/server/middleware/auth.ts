import { defineEventHandler, getRequestURL, H3Event, isMethod, sendNoContent, getHeader } from 'auth-h3client/v1';
import { generateCsrfCookie, botDetectorMiddleware, isIPValid } from 'auth-h3client/v1';

/**
 * Server middleware that handles CSRF token generation, bot detection, and IP validation.
 * Skips processing for HEAD requests, health checks, and MDC routes.
 */
export default defineEventHandler(async (event: H3Event) => {
  const { pathname } = getRequestURL(event);

  if (isMethod(event, 'HEAD') || pathname === '/api/health' || pathname.startsWith('/api/_mdc')) {
    if (isMethod(event, 'HEAD') || pathname === '/api/health') {
      sendNoContent(event);
    }
    return;
  }

  const forwardedFor = getHeader(event, 'x-forwarded-for');
  if (forwardedFor === '127.0.0.1' || forwardedFor === '::1') {
    return;
  }

  isIPValid(event);
  await botDetectorMiddleware(event);
  generateCsrfCookie(event);
});
