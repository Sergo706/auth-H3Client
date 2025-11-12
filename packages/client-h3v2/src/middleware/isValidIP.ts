import { defineHandler, getRequestIP } from 'h3'
import { isIP } from 'node:net';
import throwError from './error.js';
import { getLogger } from '../main.js';

/**
 * Rejects requests lacking a valid client IP by throwing a 403 HTTPError.
 *
 * @param event - H3 event containing the client IP address.
 * @returns void
 * @throws HTTPError When the IP is missing or malformed.
 */
export default defineHandler((event) => {
  const ipAddress = getRequestIP(event) ?? getRequestIP(event, { xForwardedFor: true }) ??
                    event.runtime?.node?.req.headers['x-real-ip'] as string | undefined;

  const log = getLogger().child({service: 'auth-client', branch: 'entry', type: 'middleware'})

    if (!ipAddress) {
      log.warn(`NULL ip address ${ipAddress}`);
      event.res.status = 403;
      event.res.statusText = 'Forbidden'
      return;
    };
    
    if (isIP(ipAddress) === 0) {
      throwError(log, event, 'AUTH_SERVER_ERROR', 403, 'Forbidden', 'BAD_CLIENT', `
        Bad client ip address ${ipAddress}
        `)
    }
})
