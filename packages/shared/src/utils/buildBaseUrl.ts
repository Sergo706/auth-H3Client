import { getConfiguration } from "../config/config.js";
import z from "zod";
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
  let host = cfg.server.auth_location.serverOrDNS;
  const ipv6 = z.ipv6()
  const isIpv6 = ipv6.safeParse(cfg.server.auth_location.serverOrDNS)

  if (isIpv6.success && !host.startsWith('[')) {
      host = `[${host}]`;
  }

  const port = cfg.server.auth_location.port ?? (usingSSL ? 443 : 80);

  const base = new URL(`${scheme}://${host}:${port}`);
  return base; 
}
