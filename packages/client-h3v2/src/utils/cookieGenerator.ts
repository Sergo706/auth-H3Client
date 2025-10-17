import type { H3Event } from "h3";
import { getRequestProtocol, setCookie } from "h3";
type cookies = {
    httpOnly: boolean,
    sameSite: boolean | "lax" | "strict" | "none";
    maxAge: number; 
    secure?: boolean;
    expires?: Date;
    domain?: string;
    path?: string; 
  };



/**
 * Sets a cookie on the response ensuring proper security attributes for special cookie prefixes.
 *
 * @param event - H3 event providing request/response state.
 * @param name - Cookie name to set.
 * @param value - Cookie value.
 * @param options - Additional cookie attributes (maxAge, sameSite, etc.).
 * @returns void
 *
 * @example
 * makeCookie(event, '__Secure-a', token, { httpOnly: true, sameSite: 'strict', maxAge: 3600 });
 */
export function makeCookie(event: H3Event, name: string, value: string, options: cookies) {
  let isSecure = process.env.NODE_ENV === 'production' || getRequestProtocol(event) === 'https';

  if (name.startsWith("__Host-")) {
    isSecure = true; 
    options.path = "/";
    delete options.domain;
  }

  if (name.startsWith("__Secure-")) {
      isSecure = true; 
  }

    setCookie(event, name, value, {
      httpOnly: options.httpOnly,
      sameSite: options.sameSite,
      maxAge: options.maxAge,
      secure: isSecure,
      expires: options.expires,
      domain: options.domain,
      path: options.path,
      });
}
