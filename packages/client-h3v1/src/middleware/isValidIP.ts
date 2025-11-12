import { defineEventHandler, getRequestIP } from 'h3';
import throwError from './error.js';
import { isIP } from 'node:net';
import { getLogger } from "../utils/logger.js";

/**
 * Rejects requests lacking a valid client IP by throwing a 403 HTTPError.
 *
 * @param event - H3 event containing the client IP address.
 * @returns void
 * @throws HTTPError When the IP is missing or malformed.
 */
export default defineEventHandler((event) => {
  const ipAddress = getRequestIP(event) ?? getRequestIP(event, { xForwardedFor: true }) ??
                    event.node.req.headers['x-real-ip'] as string | undefined;
                    
  const log = getLogger().child({service: 'auth-client', branch: 'entry', type: 'middleware'})

      if (!ipAddress) {
      throwError(log,event,'FORBIDDEN', 403, 'Forbidden', 'BAD_CLIENT', `
        No ipAddress is provided.
        ${ipAddress}
        `)
    }

    if (isIP(ipAddress) === 0) {
      throwError(log, event, 'AUTH_SERVER_ERROR', 403, 'Forbidden', 'BAD_CLIENT', `
        Bad client ip address ${ipAddress}
        `)
    }
})
