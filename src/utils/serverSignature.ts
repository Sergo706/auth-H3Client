import crypto from "node:crypto";
import { getConfiguration } from "../config/config.js";

export function signature(method: string, path: string): Record<string, string> {
  const {server} = getConfiguration() 

  const clientId  = server.hmac.clientId;
  const key = server.hmac.sharedSecret
  const timestamp = Date.now().toString();
  const reqid     = crypto.randomUUID();
  const base      = `${clientId}:${timestamp}:${method}:${path}:${reqid}`;
  
  if (!clientId || !key) {
    throw new Error('Missing server_id or server_key in config');
  }

  const signature = crypto
    .createHmac("sha256", key)
    .update(base)
    .digest("hex");

  return {
    "X-Client-Id": clientId,
    "X-Timestamp": timestamp,
    "X-Request-Id": reqid,
    "X-Signature": signature,
  };
}
