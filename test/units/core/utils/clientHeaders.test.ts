import { describe, it, expect } from 'vitest';
import { clientHeaders } from 'auth-h3client/v2';
import { createMockEvent } from '../../../setup/utils/cookieJar.js';

describe('clientHeaders', () => {
    it('should map headers correctly from H3Event', () => {
        const event = createMockEvent({
            headers: {
                'user-agent': 'TestAgent',
                'origin': 'https://origin.com',
                'host': 'host.com',
                'x-client-tls-version': 'TLS1.3',
                'x-client-cipher': 'AES-GCM',
                'accept-language': 'en',
                'accept': 'application/json',
                'sec-fetch-user': '?1',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-dest': 'document',
                'cookie': 'session=123'
            }
        });

        const headers = clientHeaders(event);

        expect(headers['User-Agent']).toBe('TestAgent');
        expect(headers['Origin']).toBe('https://origin.com');
        expect(headers['Host']).toBe('host.com');
        expect(headers['X-Client-Tls-Version']).toBe('TLS1.3');
        expect(headers['X-Client-Cipher']).toBe('AES-GCM');
        expect(headers['Accept-Language']).toBe('en');
        expect(headers['Accept']).toBe('application/json');
        expect(headers['Sec-Fetch-User']).toBe('?1');
        expect(headers['Sec-Fetch-Site']).toBe('same-origin');
        expect(headers['Sec-Fetch-Mode']).toBe('navigate');
        expect(headers['Sec-Fetch-Dest']).toBe('document');
        expect(headers['Cookie']).toBe('session=123');
    });

    it('should handle X-Real-IP and X-Forwarded-For prioritization', () => {
        const event = createMockEvent({
            headers: {
                'x-real-ip': '1.2.3.4',
                'x-forwarded-for': '5.6.7.8'
            }
        });

        const headers = clientHeaders(event);
        expect(headers['X-Real-IP']).toBe('1.2.3.4');
        expect(headers['X-Forwarded-For']).toBe('1.2.3.4');
    });

    it('should populate Referer and X-Original-Path based on event data', () => {
        const event = createMockEvent({
            url: 'https://app.com/path',
            headers: {
                'host': 'app.com',
                'x-forwarded-host': 'app.com',
                'x-forwarded-proto': 'https'
            }
        });

        const headers = clientHeaders(event);
        expect(headers['Referer']).toBe('https://app.com');
        expect(headers['X-Original-Path']).toBe('https://app.com/path');
        expect(headers['X-Forwarded-Proto']).toBe('https');
    });

    it('should provide default Date if not present in headers', () => {

        const event = createMockEvent({ headers: {} });
        const headers = clientHeaders(event);
        
        expect(headers['Date']).toBeDefined();
        expect(new Date(headers['Date'] as string).getTime()).not.toBeNaN();
    });
});
