import { describe, it, expect } from 'vitest';
import { makePkcePair } from '@internal/shared';
import crypto from 'node:crypto';

describe('pkce', () => {
    it('should generate a valid PKCE pair and verify integrity', () => {
        const { verifier, challenge } = makePkcePair();
        
        expect(verifier).toBeDefined();
        expect(challenge).toBeDefined();
        
      
        expect(typeof verifier).toBe('string');
        expect(verifier.length).toBe(86);
        
    
        const expectedChallenge = crypto
            .createHash("sha256")
            .update(verifier)
            .digest('base64url');
            
        expect(challenge).toBe(expectedChallenge);
        
        expect(challenge).not.toContain('+');
        expect(challenge).not.toContain('/');
        expect(challenge).not.toContain('=');
    });

    it('should generate different pairs each time', () => {
        const set = new Set();
        for (let i = 0; i < 100; i++) {
            const { verifier } = makePkcePair();
            expect(set.has(verifier)).toBe(false);
            set.add(verifier);
        }
    });

    it('should generate valid base64url strings for all components', () => {
        const { verifier, challenge } = makePkcePair();
        
        const b64urlRegex = /^[A-Za-z0-9\-_]+$/;
        
        expect(verifier).toMatch(b64urlRegex);
        expect(challenge).toMatch(b64urlRegex);
    });
});
