import { describe, it, expect } from 'vitest';
import { atHashCheck } from '@internal/shared';

describe('atHashCheck (Rigor)', () => {
    const accessToken = 'y_u_no_refresh_token_?';
    
    const generateIdToken = (alg: string) => {
        const header = { alg, typ: 'JWT' };
        return `${Buffer.from(JSON.stringify(header)).toString('base64url')}.payload.signature`;
    };

    it('should return true for valid at_hash with RS256 (SHA-256)', async () => {
        const idToken = generateIdToken('RS256');
        const crypto = await import('node:crypto');
        const hash = crypto.createHash('sha256').update(accessToken, 'ascii').digest();
        const leftHalf = hash.subarray(0, hash.length / 2);
        const validAtHash = leftHalf.toString('base64url');

        expect(atHashCheck(validAtHash, accessToken, idToken)).toBe(true);
    });

    it('should return true for valid at_hash with HS384 (SHA-384)', async () => {
        const idToken = generateIdToken('HS384');
        const crypto = await import('node:crypto');
        const hash = crypto.createHash('sha384').update(accessToken, 'ascii').digest();
        const leftHalf = hash.subarray(0, hash.length / 2);
        const validAtHash = leftHalf.toString('base64url');

        expect(atHashCheck(validAtHash, accessToken, idToken)).toBe(true);
    });

    it('should return true for valid at_hash with RS512 (SHA-512)', async () => {
        const idToken = generateIdToken('RS512');
        const crypto = await import('node:crypto');
        const hash = crypto.createHash('sha512').update(accessToken, 'ascii').digest();
        const leftHalf = hash.subarray(0, hash.length / 2);
        const validAtHash = leftHalf.toString('base64url');

        expect(atHashCheck(validAtHash, accessToken, idToken)).toBe(true);
    });

    it('should reject invalid or tampered at_hash', () => {
        const idToken = generateIdToken('RS256');
        expect(atHashCheck('invalid_hash', accessToken, idToken)).toBe(false);
        expect(atHashCheck('', accessToken, idToken)).toBe(false);
    });

    it('should fail if header alg is missing or unsupported', () => {
        const noAlgToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.e30.dummy'; 
        expect(atHashCheck('any', accessToken, noAlgToken)).toBe(false);
        
        const badToken = 'not-a-jwt';
        expect(atHashCheck('any', accessToken, badToken)).toBe(false);
    });
});
