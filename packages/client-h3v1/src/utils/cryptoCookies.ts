import crypto from "crypto";
import { Buffer } from "node:buffer";
import { getConfiguration } from "../config/config.js";



const Key = (): string => {
   const secret = getConfiguration()
   return secret.server.cryptoCookiesSecret
}

/**
 * Encodes a string or buffer using base64url.
 *
 * @param d - Raw data to encode.
 * @returns Base64url encoded string.
 *
 * @example
 * const encoded = toB64('secret');
 */
export const toB64  = (d: string|Buffer) => Buffer.from(d).toString("base64url");
/**
 * Decodes a base64url string into UTF-8 text.
 *
 * @param b - Base64url encoded string.
 * @returns Decoded UTF-8 text.
 *
 * @example
 * const decoded = fromB64(encodedValue);
 */
export const fromB64 = (b: string) => Buffer.from(b, "base64url").toString("utf8");

function sign(value: string): string {
  return crypto.createHmac("sha256", Key()).update(value).digest("hex");
}

/**
 * Compares two HMAC signatures using a timing-safe equality check.
 *
 * @param a - First signature.
 * @param b - Second signature.
 * @returns `true` when the signatures match; otherwise `false`.
 */
export function isSame(a: string, b: string) {
  const A = Buffer.from(a, "hex");
  const B = Buffer.from(b, "hex");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

/**
 * Produces a signed cookie string containing the payload, session tag, and expiration.
 *
 * @param raw - Raw cookie value to sign.
 * @param ttlMs - Time-to-live in milliseconds.
 * @param session - Session label embedded in the cookie.
 * @returns Signed cookie string.
 *
 * @example
 * const cookie = createSignedCookie(uuid, 60_000, 'normal');
 */
export function createSignedCookie(raw: string, ttlMs: number, session:string): string {
  const value   = toB64(raw);  
  const exp   = Date.now() + ttlMs; 
  const sessions = toB64(session); 
  const body  = `${value}.${sessions}.${exp}`; 
  return `${body}.${sign(body)}`;
}

export interface VerifiedCookie {
  valid: boolean;
  payload?: { 
  value: string;
  session: string;
  exp: number;
}
}

/**
 * Verifies a signed cookie matches the expected session keyword and has not expired.
 *
 * @param cookie - Signed cookie string to validate.
 * @param keyWord - Expected session keyword.
 * @returns Verification result with payload when successful.
 *
 * @example
 * const { valid, payload } = verifySignedCookie(cookieValue, 'normal');
 */
export function verifySignedCookie(cookie: string, keyWord: string): VerifiedCookie {
  const parts = cookie.split(".");
  if (parts.length !== 4) return { valid: false }; 

  const [value, sessB64, expStr, sig] = parts;
  const body = `${value}.${sessB64}.${expStr}`;

  if (!isSame(sig, sign(body))) return { valid: false };

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return { valid: false };


  let session: string;
  try {
    session = fromB64(sessB64);
  } catch {
    return { valid: false };     
  }
  if (session !== keyWord) return { valid: false };

  return { 
    valid: true, 
    payload: { 
      value: value, 
      session, 
      exp 
    }
  };
}
