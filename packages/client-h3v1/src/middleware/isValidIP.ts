import { defineEventHandler, getRequestIP, createError } from 'h3';
import { isIP } from 'node:net';

/**
 * Rejects requests lacking a valid client IP by throwing a 403 HTTPError.
 *
 * @param event - H3 event containing the client IP address.
 * @returns void
 * @throws HTTPError When the IP is missing or malformed.
 */
export default defineEventHandler((event) => {
  const ipAddress = getRequestIP(event)
    if (!ipAddress || isIP(ipAddress) === 0) {
        throw createError({
           data: { date: new Date().toJSON(), code: 'BAD_CLIENT' },
            status: 403,
            statusText: "Forbidden",
        })
    }
})
