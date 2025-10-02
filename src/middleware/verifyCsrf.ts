import { verifySignedCookie } from "../utils/cryptoCookies.js";
import { defineHandler, getCookie, HTTPError, readBody } from 'h3'
import { getLogger } from "../utils/logger.js";


export default defineHandler( async (event) => {

    const log = getLogger().child({service: `csrf`, branch: `general`})
    const name = '__Host-csrf';
    const cookie = getCookie(event, name)

    log.info(`Verifying csrf token...`)

    if (!cookie) {
        log.warn(`CSRF cookie missing`)
        throw new HTTPError({
            body: { date: new Date().toJSON(), code: 'CSRF_MISSING' },
            status: 403,
            statusText: "Forbidden",
        })
    }

    const { valid, payload } = verifySignedCookie(cookie, "csrf");
        if (!valid || !payload) {
        log.warn(`CSRF cookie invalid or expired`)
        throw new HTTPError({
            body: { date: new Date().toJSON(), code: 'CSRF_INVALID' },
            status: 403,
            statusText: "Forbidden",
        })
        }
    
    const token = event.req.headers.get("X-CSRF-Token");

    if (!token) {
    log.warn(`CSRF token not provided`)
       throw new HTTPError({
            body: { date: new Date().toJSON(), code: 'TOKEN_INVALID' },
            status: 403,
            statusText: "Forbidden",
        })
    }   
    if (token !== payload.value) {
        log.warn(`CSRF token mismatch`)
        throw new HTTPError({
            body: { date: new Date().toJSON(), code: 'TOKEN_INVALID' },
            status: 403,
            statusText: "Forbidden",
        })
  }
   log.info(`CSRF token verified`)
})