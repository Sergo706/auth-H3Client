import { describe, it, expect } from 'vitest';
// @ts-ignore
import { getSafeUrl } from 'auth-h3client/v2';
import { createMockEvent } from '../../../setup/utils/cookieJar.js';

describe('getSafeUrl', () => {
    it('should return URL from getRequestURL when it successful', () => {
        const event = createMockEvent({ url: 'https://example.com/api/test' });
        const url = getSafeUrl(event);
        
        expect(url.href).toBe('https://example.com/api/test');
        expect(url.pathname).toBe('/api/test');
    });

    it('should respect x-forwarded headers when getRequestURL used', () => {
        const event = createMockEvent({ 
            url: 'http://localhost/api/test',
            headers: {
                'x-forwarded-host': 'my.production.app',
                'x-forwarded-proto': 'https'
            }
        });
        const url = getSafeUrl(event);
    

        expect(url.href).toBe('https://my.production.app/api/test');
    });

    it('should handle relative URLs by resolving against local default', () => {
        const event = createMockEvent({ url: '/api/v1/auth' });
        const url = getSafeUrl(event);
        
        expect(url.pathname).toBe('/api/v1/auth');
        expect(url.hostname).toBe('localhost');
    });
});
