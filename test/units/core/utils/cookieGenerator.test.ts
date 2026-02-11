import { describe, it, expect } from 'vitest';
import { makeCookie } from 'auth-h3client/v2';
import { createMockEvent } from '../../../setup/utils/cookieJar.js';

describe('cookieGenerator - makeCookie', () => {

    it('should set a basic cookie with provided options', () => {
        const event = createMockEvent();
        makeCookie(event, 'test-cookie', 'value', { 
            httpOnly: true, 
            sameSite: 'lax', 
            maxAge: 3600 
        });

        const setCookies = event.res.headers.getSetCookie();
        expect(setCookies).toEqual(expect.arrayContaining([
            expect.stringContaining('test-cookie=value'),
            expect.stringContaining('HttpOnly'),
            expect.stringContaining('SameSite=Lax'),
            expect.stringContaining('Max-Age=3600')
        ]));
    });

    it('should enforce __Host- prefix requirements (Secure, Path=/, No Domain)', () => {
        const event = createMockEvent();
        const options: any = { 
            httpOnly: true, 
            sameSite: 'strict', 
            maxAge: 3600, 
            domain: 'example.com', 
            path: '/api' 
        };

        makeCookie(event, '__Host-session', 'secret', options);

        const setCookies = event.res.headers.getSetCookie();
        expect(setCookies).toEqual(expect.arrayContaining([
            expect.stringContaining('__Host-session=secret'),
            expect.stringContaining('Secure'),
            expect.stringContaining('Path=/'),
        ]));
        
     
        const sessionCookie = setCookies.find(c => c.startsWith('__Host-session'));
        expect(sessionCookie).not.toContain('Domain=');
    });

    it('should enforce __Secure- prefix requirement', () => {
        const event = createMockEvent();
        makeCookie(event, '__Secure-auth', 'token', { 
            httpOnly: true, 
            sameSite: 'strict', 
            maxAge: 3600 
        });

        const setCookies = event.res.headers.getSetCookie();
        expect(setCookies).toEqual(expect.arrayContaining([
            expect.stringContaining('__Secure-auth=token'),
            expect.stringContaining('Secure')
        ]));
    });
});
