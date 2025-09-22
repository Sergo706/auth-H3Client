import crypto from 'crypto'
import { createSignedCookie } from '../utils/cryptoCookies.js'
import { defineHandler, getCookie } from 'h3'
import { makeCookie } from '../utils/cookieGenerator.js'
import { getLogger } from '../utils/logger.js'

export default defineHandler( (event) => {
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
        maxAge: 1000 * 60 * 30,
        secure: true,
      })
      log.info(`Csrf token generated`)
})