import { getHeader, getRequestHost, getRequestIP, getRequestProtocol, getRequestURL, type H3Event } from 'h3'

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
    const clientIp = getRequestIP(event) || undefined
    const protocol = getRequestProtocol(event, {xForwardedProto: false})
    const host = getRequestHost(event, {xForwardedHost: false});
    const url = getRequestURL(event);

      const get = (name: string) => getHeader(event, name) ?? undefined;

return {
    'User-Agent': get('User-Agent') ?? '',
    'X-Forwarded-For': clientIp,
    'X-Real-IP': clientIp,
    "Referer": `${protocol}://${host}`,
    "Origin":  get("Origin") || "",
    "Host": get("host"),
    "X-Original-Path": url.toString(),
    "X-Forwarded-Host": get("X-Forwarded-Host") || "",
    "X-Forwarded-Proto": protocol,
    'X-Client-Tls-Version': get('x-client-tls-version'),
    'X-Client-Cipher': get('x-client-cipher'),
    "Date": get("date") || new Date().toISOString() || "",
    "Cookie": get("cookie") || "",
    "Accept-Language": get("Accept-Language") || "",
    "Accept": get("Accept") || "",
    "Sec-Fetch-User": get("sec-fetch-user") || "",
    "Sec-Fetch-Site": get("Sec-Fetch-Site") || "",
    "Sec-Fetch-Mode": get("Sec-Fetch-Mode") || "",
    "Sec-Fetch-Dest": get("Sec-Fetch-Dest") || "",
}
}
