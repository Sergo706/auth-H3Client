import { getConfiguration } from "../config/config.js";

export function getBaseUrl(cfg: ReturnType<typeof getConfiguration>) {
  const usingSSL = !!cfg.server.ssl.enableSSL;
  const scheme = usingSSL ? "https" : "http";
  const host = cfg.server.auth_location.serverOrDNS; 
  const port = cfg.server.auth_location.port ?? (usingSSL ? 443 : 80);

  const base = new URL(`${scheme}://${host}:${port}`);
  return base; 
}
