import { getConfiguration } from "../config/config.js";

/**
 * Derives the base URL for the auth server from the loaded configuration.
 *
 * @param cfg - Resolved runtime configuration.
 * @returns URL instance pointing to the auth server origin.
 *
 * @example
 * const baseUrl = getBaseUrl(getConfiguration());
 */
export function getBaseUrl(cfg: ReturnType<typeof getConfiguration>) {
  const usingSSL = !!cfg.server.ssl.enableSSL;
  const scheme = usingSSL ? "https" : "http";
  const host = cfg.server.auth_location.serverOrDNS; 
  const port = cfg.server.auth_location.port ?? (usingSSL ? 443 : 80);

  const base = new URL(`${scheme}://${host}:${port}`);
  return base; 
}
