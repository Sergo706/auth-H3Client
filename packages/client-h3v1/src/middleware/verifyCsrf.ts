import { verifySignedCookie } from "@internal/shared";
import { createError, defineEventHandler, getCookie, getHeader } from 'h3'
import { getLogger } from "@internal/shared";


/**
 * Validates the CSRF cookie and header token pair, rejecting requests when the signature is missing or invalid.
 *
 * @param event - H3 event representing the incoming state-changing request.
 * @returns void
 * @throws HTTPError When the CSRF token is missing or invalid.
 *
 * @example
 * router.post('/dangerous', handler, { middleware: [verifyCsrf] });
 */
export default defineEventHandler( async (event) => {

    const log = getLogger().child({service: `csrf`, branch: `general`})
    const name = '__Host-csrf';
    const cookie = getCookie(event, name)

    log.info(`Verifying csrf token...`)

    if (!cookie) {
        log.warn(`CSRF cookie missing`)
        throw createError({
            data: { date: new Date().toJSON(), code: 'CSRF_MISSING' },
            status: 403,
            statusText: "Forbidden",
        })
    }

    const { valid, payload } = verifySignedCookie(cookie, "csrf");
        if (!valid || !payload) {
        log.warn(`CSRF cookie invalid or expired`)
        throw createError({
            data: { date: new Date().toJSON(), code: 'CSRF_INVALID' },
            status: 403,
            statusText: "Forbidden",
        })
        }
    
    const token = getHeader(event, "X-CSRF-Token");

    if (!token) {
    log.warn(`CSRF token not provided`)
       throw createError({
            data: { date: new Date().toJSON(), code: 'TOKEN_INVALID' },
            status: 403,
            statusText: "Forbidden",
        })
    }   
    if (token !== payload.value) {
        log.warn(`CSRF token mismatch`)
        throw createError({
            data: { date: new Date().toJSON(), code: 'TOKEN_INVALID' },
            status: 403,
            statusText: "Forbidden",
        })
  }
   log.info(`CSRF token verified`)
})
