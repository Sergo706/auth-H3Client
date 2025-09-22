import { defineHandler, HTTPError } from 'h3'
import { isIP } from 'node:net';

export default defineHandler((event) => {
  const ipAddress = event.req.ip
    if (!ipAddress || isIP(ipAddress) === 0) {
        throw new HTTPError({
           body: { date: new Date().toJSON(), code: 'BAD_CLIENT' },
            status: 403,
            statusText: "Forbidden",
        })
    }
})
