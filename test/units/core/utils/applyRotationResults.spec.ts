import { applyRotationResult } from 'auth-h3client/v2';
import {it,describe, expect } from 'vitest'
import { createMockEvent } from '../../../setup/utils/cookieJar.js';


describe('applyRotationResult', () => {
    const event = createMockEvent()

    it("Set both tokens as cookies and context", (context) => {
        const iat = new Date().toISOString()
        const res = applyRotationResult(event, 
            {
                type: 'both',
                newToken: '1234',
                newRefresh: '123456',
                accessIat: iat,
                rawSetCookie: ["cookie1=value1; Path=/; HttpOnly", "cookie2=value2; Path=/; Secure"]
            },
             'localhost',
             new Date().getTime() + new Date().getTime() + 1000 * 60 * 5
        )
        expect(event.context.accessToken).toBe('1234')
        expect(event.context.session).toBe('123456')
        expect(event.context.isRotated).toBe(true)
        const setCookies = event.res.headers.getSetCookie()
        expect(setCookies).toEqual(expect.arrayContaining([
            expect.stringContaining('cookie1=value1'),
            expect.stringContaining('cookie2=value2'),
        ]))            
            
        expect(setCookies).toEqual(expect.arrayContaining([
            expect.stringContaining('__Secure-a=1234'),
            expect.stringContaining(`a-iat=${encodeURIComponent(iat)}`)
        ]))
    })

    it("Apply Access Token Rotation", () => {
        const iat = new Date().toISOString()
        const res = applyRotationResult(event, 
            {
                type: 'access',
                newToken: 'new-access-token',
                accessIat: iat,
            },
             'localhost',
             1000 * 60 * 5
        )

        expect(event.context.accessToken).toBe('new-access-token')
        expect(event.context.isRotated).toBe(true)
        
        const setCookies = event.res.headers.getSetCookie()
        expect(setCookies).toEqual(expect.arrayContaining([
            expect.stringContaining('__Secure-a=new-access-token'),
            expect.stringContaining(`a-iat=${encodeURIComponent(iat)}`)
        ]))
    })

    it("Apply Refresh Token Rotation", () => {
        const res = applyRotationResult(event, 
            {
                type: 'refresh',
                newRefresh: 'new-refresh-token',
                rawSetCookie: ["refresh=new-refresh-value; Path=/; HttpOnly"]
            },
             'localhost',
             1000 * 60 * 5
        )

        expect(event.context.session).toBe('new-refresh-token')
        expect(event.context.isRotated).toBe(true)

        const setCookies = event.res.headers.getSetCookie()
        
        expect(setCookies).toEqual(expect.arrayContaining([
            expect.stringContaining('session=; Max-Age=0'),
            expect.stringContaining('iat=; Max-Age=0')
        ]))

  
        expect(setCookies).toEqual(expect.arrayContaining([
            expect.stringContaining('refresh=new-refresh-value')
        ]))
    })
})