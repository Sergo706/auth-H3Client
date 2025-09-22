import type { H3Event } from "h3";
import { setCookie } from "h3";
type cookies = {
    httpOnly: boolean,
    sameSite: boolean | "lax" | "strict" | "none";
    maxAge: number; 
    secure: boolean; 
    expires?: Date;
    domain?: string;
    path?: string; 
  };



export function makeCookie(event: H3Event, name: string, value: string, options: cookies) {

  if (name.startsWith("__Host-")) {
    options.secure = true;
    options.path = "/";
    delete options.domain;
  }

  if (name.startsWith("__Secure-")) {
    options.secure = true;
  }

    setCookie(event, name, value, {
      httpOnly: options.httpOnly,
      sameSite: options.sameSite,
      maxAge: options.maxAge,
      secure: options.secure,
      expires: options.expires,
      domain: options.domain,
      path: options.path,
      });
}
