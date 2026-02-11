import { describe, it, expect } from 'vitest';
import { signature, getConfiguration } from '@internal/shared';
import crypto from 'node:crypto';

describe('serverSignature', () => {
    it('should generate valid signature headers and verify mathematical correctness', () => {
        const method = 'POST';
        const path = '/auth/login?test=1';
        
        const headers = signature(method, path);
        const config = getConfiguration();
        const clientId = config.server.hmac.clientId;
        const key = config.server.hmac.sharedSecret!;
        
        expect(headers['X-Client-Id']).toBe(clientId);
        expect(headers['X-Timestamp']).toBeDefined();
        expect(headers['X-Request-Id']).toBeDefined();
        
        const timestamp = headers['X-Timestamp'];
        const reqid = headers['X-Request-Id'];
        const base = `${clientId}:${timestamp}:${method}:${path}:${reqid}`;
        
        const expectedSignature = crypto
            .createHmac("sha256", key)
            .update(base)
            .digest("hex");
            
        expect(headers['X-Signature']).toBe(expectedSignature);
        expect(headers['X-Signature']).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different signatures for different inputs (Entropy & State)', () => {
        const h1 = signature('GET', '/path');
        const h2 = signature('GET', '/path'); 
        
        expect(h1['X-Signature']).not.toBe(h2['X-Signature']);
        expect(h1['X-Request-Id']).not.toBe(h2['X-Request-Id']);
    });

    it('should handle varied paths including query strings and special characters', () => {
        const paths = [
            '/api/v1/user/123',
            '/auth/callback?code=123&state=abc',
            '/search?q=hello%20world',
            '/',
            '/path/with space/'
        ];
        
        for (const path of paths) {
            const result = signature('GET', path);
            expect(result['X-Signature']).toMatch(/^[a-f0-9]{64}$/);
        }
    });

    it('should include the method in the signature base', () => {
        const path = '/resource';
        const h1 = signature('GET', path);
        const h2 = signature('PATCH', path);
        
        expect(h1['X-Signature']).not.toBe(h2['X-Signature']);
    });
});
