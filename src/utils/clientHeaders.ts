import { getRequestHost, getRequestIP, getRequestProtocol, getRequestURL, type H3Event } from 'h3'

export function clientHeaders( event: H3Event ): Record<string, string | undefined> {
    const clientIp = getRequestIP(event) || undefined
    const protocol = getRequestProtocol(event, {xForwardedProto: false})
    const host = getRequestHost(event, {xForwardedHost: false});
    const url = getRequestURL(event);

      const h = event.req.headers as Headers;
      const get = (name: string) => h.get(name) ?? undefined;

return {
    'User-Agent': h.get('User-Agent') ?? '',
    'X-Forwarded-For': clientIp,
    'X-Real-IP': clientIp,
    "Referer": `${protocol}://${host}${url}`,
    "Origin":  get("Origin") || "",
    "Host": get("host"),
    "X-Original-Path": url.toString(),
    "X-Forwarded-Host": get("X-Forwarded-Host") || "",
    "X-Forwarded-Proto": protocol,
    'X-Client-Tls-Version': get('x-client-tls-version'),
    'X-Client-Cipher': get('x-client-cipher'),
    "Date": get("date") || "",
    "Cookie": get("cookie") || "",
    "authorization": get('authorization') || "",
    "Accept-Language": get("Accept-Language") || "",
    "Accept": get("Accept") || "",
    "Sec-Fetch-User": get("sec-fetch-user") || "",
    "Sec-Fetch-Site": get("Sec-Fetch-Site") || "",
    "Sec-Fetch-Mode": get("Sec-Fetch-Mode") || "",
    "Sec-Fetch-Dest": get("Sec-Fetch-Dest") || "",
}
}
