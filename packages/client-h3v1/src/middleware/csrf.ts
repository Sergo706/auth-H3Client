import crypto from 'crypto'
import { createSignedCookie } from '../utils/cryptoCookies.js'
import { defineEventHandler, getCookie } from 'h3'
import { makeCookie } from '../utils/cookieGenerator.js'
import { getLogger } from '../utils/logger.js'

/**
 * Ensures a CSRF cookie exists for the current request, minting and signing a new one when absent.
 *
 * @param event - H3 event representing the incoming request.
 * @returns void
 *
 * @example
 * router.use(csrfTokenMiddleware);
 */
export default defineEventHandler((event) => {
const name = '__Host-csrf'
const log = getLogger().child({service: `csrf`, branch: `general`})

const existing = getCookie(event, name)
 if (existing) return;

 const rawToken = crypto.randomBytes(32).toString('hex');
 const ttl = 1000 * 60 * 30
 const sign = createSignedCookie(rawToken, ttl, 'csrf')

    makeCookie(event, name, sign, {
        httpOnly: false,
        sameSite: "strict", 
        maxAge: 60 * 30,
        secure: true,
      })
      log.info(`Csrf token generated`)
})
