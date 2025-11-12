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
  const ipAddress = getRequestIP(event)
  const log = getLogger().child({service: 'auth-client', branch: 'entry', type: 'middleware'})
    if (!ipAddress || isIP(ipAddress) === 0) {
      throwError(log, event, 'AUTH_SERVER_ERROR', 403, 'Forbidden', 'BAD_CLIENT', `
        Bad client ip address ${ipAddress}
        `)
    }
})
