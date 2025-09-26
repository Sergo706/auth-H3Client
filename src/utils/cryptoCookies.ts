import crypto from "crypto";
import { Buffer } from "node:buffer";
import { getConfiguration } from "../config/config.js";



const Key = (): string => {
   const secret = getConfiguration()
   return secret.server.cryptoCookiesSecret
}

export const toB64  = (d: string|Buffer) => Buffer.from(d).toString("base64url");
export const fromB64 = (b: string) => Buffer.from(b, "base64url").toString("utf8");

function sign(value: string): string {
  return crypto.createHmac("sha256", Key()).update(value).digest("hex");
}

function isSame(a: string, b: string) {
  const A = Buffer.from(a, "hex");
  const B = Buffer.from(b, "hex");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

export function createSignedCookie(raw: string, ttlMs: number, session:string): string {
  const value   = toB64(raw);  
  const exp   = Date.now() + ttlMs; 
  const sessions = toB64(session); 
  const body  = `${value}.${sessions}.${exp}`; 
  return `${body}.${sign(body)}`;
}

interface VerifiedCookie {
  valid: boolean;
  payload?: { 
  value: string;
  session: string;
  exp: number;
}
}

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

