import { getHeader, getHeaders, getRequestHost, getRequestIP, getRequestProtocol, getRequestURL, type H3Event } from 'h3'

/**
 * Builds a sanitized set of client headers to forward to upstream auth services.
 *
 * @param event - Current H3 event providing request metadata.
 * @returns Dictionary of headers safe to forward upstream.
 *
 * @example
 * const headers = clientHeaders(event);
 */
export function clientHeaders( event: H3Event ): Record<string, string | undefined> {
    const xReal = getHeader(event, 'x-real-ip')
    const clientIp = xReal || getRequestIP(event, {xForwardedFor: true}) || undefined
    const protocol = getRequestProtocol(event, {xForwardedProto: true})
    const host = getRequestHost(event, {xForwardedHost: true});
    const url = getRequestURL(event,{xForwardedHost: true, xForwardedProto:true});
    
      const rawHeaders = getHeaders(event);
      const finalHeaders: Record<string, string> = {};

      for (const [key, value] of Object.entries(rawHeaders)) {
          if (value !== undefined && value !== null && value !== '') {
              finalHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
          }
      }

      if (clientIp) {
          finalHeaders['x-forwarded-for'] = clientIp;
          finalHeaders['x-real-ip'] = clientIp;
      }
      
      finalHeaders['x-original-path'] = url.toString();
      finalHeaders['x-forwarded-host'] = finalHeaders['x-forwarded-host'] || host;
      finalHeaders['x-forwarded-proto'] = protocol;

      if (!finalHeaders['referer']) {
        finalHeaders['referer'] = `${protocol}://${host}`;
      }

      if (!finalHeaders['date']) {
           finalHeaders['date'] = new Date().toISOString();
      }
      delete finalHeaders['content-length'];
      delete finalHeaders['x-api-key'];
      delete finalHeaders['content-type'];
      delete finalHeaders['accept'];
      return finalHeaders;
}
