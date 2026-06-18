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

      const get = (name: string) => getHeader(event, name) ?? undefined;
      const headers = {
          ...getHeaders(event),
          'user-agent': get('User-Agent') ?? '',
          'x-forwarded-for': clientIp,
          'x-real-ip': clientIp,
          "referer": `${protocol}://${host}`,
          "origin":  get("Origin") || "",
          "host": get("host"),
          "x-original-path": url.toString(),
          "x-forwarded-host": get("X-Forwarded-Host") || "",
          "x-forwarded-proto": protocol,
          'x-client-tls-version': get('x-client-tls-version'),
          'x-client-cipher': get('x-client-cipher'),
          "date": get("date") || new Date().toISOString() || "",
          "cookie": get("cookie") || "",
          "accept-language": get("accept-language") || "",
          "accept": get("Accept") || "",
          "sec-fetch-user": get("sec-fetch-user") || "",
          "sec-fetch-site": get("sec-fetch-site") || "",
          "sec-fetch-mode": get("sec-fetch-mode") || "",
          "sec-fetch-dest": get("sec-fetch-dest") || "",
      };

      const finalHeaders: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(headers)) {
          if (v) {
              finalHeaders[k.toLowerCase()] = String(v);
          }
      }
      return finalHeaders;
}
