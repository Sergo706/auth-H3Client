import { describe, it, expect } from 'vitest';
import { toB64, fromB64, createSignedCookie, verifySignedCookie, isSame } from '@internal/shared';

describe('cryptoCookies', () => {

    describe('base64url utilities', () => {
        it('should encode and decode base64url correctly', () => {
            const data = 'Hello World & Friends';
            const encoded = toB64(data);
            expect(encoded).not.toContain('+');
            expect(encoded).not.toContain('/');
            expect(encoded).not.toContain('=');
            
            const decoded = fromB64(encoded);
            expect(decoded).toBe(data);
        });

        it('should handle buffers', () => {
            const buf = Buffer.from([1, 2, 3, 255]);
            const encoded = toB64(buf);
            expect(encoded).toBe('AQID_w');
        });
    });

    describe('isSame', () => {
        it('should compare valid hex signatures timing-safely', () => {
            const hex1 = 'abcdef';
            const hex2 = 'abcdef';
            const hex3 = '123456';
            
            expect(isSame(hex1, hex2)).toBe(true);
            expect(isSame(hex1, hex3)).toBe(false);
        });

        it('should return false for different lengths', () => {
            expect(isSame('abc', 'abcd')).toBe(false);
        });
    });

    describe('Signed Cookies', () => {
        it('should create and verify a signed cookie', () => {
            const raw = 'my-secret-payload';
            const ttl = 1000 * 60; 
            const session = 'normal';
            
            const cookie = createSignedCookie(raw, ttl, session);
            expect(cookie).toContain('.');
            expect(cookie.split('.')).toHaveLength(4);
            
            const { valid, payload } = verifySignedCookie(cookie, session);
            expect(valid).toBe(true);
            expect(payload?.value).toBe(toB64(raw));
            expect(payload?.session).toBe(session);
            expect(payload?.exp).toBeGreaterThan(Date.now());
        });

        it('should handle payloads with dots correctly (B64 encoding avoids split conflict)', () => {
            const raw = 'user.data.with.dots';
            const cookie = createSignedCookie(raw, 60000, 'session');
            const { valid, payload } = verifySignedCookie(cookie, 'session');
            
            expect(valid).toBe(true);
            expect(fromB64(payload!.value)).toBe(raw);
        });

        it('should handle very large payloads', () => {
            const largeRaw = 'a'.repeat(10000);
            const cookie = createSignedCookie(largeRaw, 60000, 'session');
            const { valid, payload } = verifySignedCookie(cookie, 'session');
            
            expect(valid).toBe(true);
            expect(fromB64(payload!.value)).toBe(largeRaw);
        });

        it('should reject tampered cookies', () => {
            const cookie = createSignedCookie('data', 60000, 'auth');
            const parts = cookie.split('.');

            parts[0] = toB64('hacked');
            const tampered = parts.join('.');
            
            expect(verifySignedCookie(tampered, 'auth').valid).toBe(false);
        });

        it('should reject tampered expiration', () => {
            const cookie = createSignedCookie('data', 60000, 'auth');
            const parts = cookie.split('.');

            parts[2] = (Date.now() + 1000000).toString();
            const tampered = parts.join('.');
            
            expect(verifySignedCookie(tampered, 'auth').valid).toBe(false);
        });

        it('should reject expired cookies', async () => {
            const cookie = createSignedCookie('data', 10, 'auth'); 
            await new Promise(r => setTimeout(r, 20));
            
            expect(verifySignedCookie(cookie, 'auth').valid).toBe(false);
        });

        it('should reject wrong session keyword', () => {
            const cookie = createSignedCookie('data', 60000, 'admin');
            expect(verifySignedCookie(cookie, 'user').valid).toBe(false);
        });

        it('should reject malformed cookies (wrong part count)', () => {
            expect(verifySignedCookie('one.two.three', 'session').valid).toBe(false);
            expect(verifySignedCookie('one.two.three.four.five', 'session').valid).toBe(false);
            expect(verifySignedCookie('', 'session').valid).toBe(false);
        });

        it('should handle invalid base64 in session tag gracefully', () => {
            const cookie = `value.invalid!!b64.12345.signature`;
            expect(verifySignedCookie(cookie, 'session').valid).toBe(false);
        });
    });
});
