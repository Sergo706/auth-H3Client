import { describe, it, expect, vi } from 'vitest';
import { safeObjectMerge } from '@internal/shared';

describe('safeObjectMerge (Rigor)', () => {
    it('should NOT overwrite reserved keys', () => {
        const target = { 
            profile: { name: 'Sergio', email: 'existing@example.com' },
            meta: { loginCount: 10 }
        };
        const src = { 
            profile: { email: 'new@example.com', twitter: '@sergio' },
            meta: { lastLogin: '2026-02-11' }
        };
        

        const result = safeObjectMerge(target, src) as any;
        
        expect(result.profile.email).toBe('existing@example.com'); 
        expect(result.profile.twitter).toBeUndefined(); 
        expect(result.meta.lastLogin).toBe('2026-02-11');
        expect(result.meta.loginCount).toBeUndefined(); 
    });

    it('should merge if reserved key is missing in target', () => {
        const target: any = { other: 1 };
        const src = { name: 'New Name' };
        
        safeObjectMerge(target, src);
        expect(target.name).toBe('New Name');
    });

    it('should handle complex reserved key scenarios (sub, email, aud, iss)', () => {
        const target: any = { sub: 'user_1', email: 'a@b.com' };
        const src = { sub: 'user_2', email: 'c@d.com', isAdmin: true };
        
        safeObjectMerge(target, src);
        
        expect(target.sub).toBe('user_1');
        expect(target.email).toBe('a@b.com');
        expect(target.isAdmin).toBe(true);
    });

    it('should handle arrays as values (shallow overwrite for non-reserved)', () => {
        const target: any = { roles: ['user'] };
        const src = { roles: ['admin', 'editor'] };
        
        safeObjectMerge(target, src);
        expect(target.roles).toEqual(['admin', 'editor']);
    });

    it('should merge with extra reserved keys provided as a Set', () => {
        const target: any = { internal_id: '123' };
        const src = { internal_id: '456', public_id: 'abc' };
        const extra = new Set(['internal_id']);
        
        safeObjectMerge(target, src, {}, extra);
        expect(target.internal_id).toBe('123'); 
        expect(target.public_id).toBe('abc');
    });

    it('should prevent prototype pollution attempts', () => {
        const target: any = {};
        const src: any = { 
            __proto__: { polluted: true },
            constructor: { prototype: { polluted: true } }
        };

        safeObjectMerge(target, src);
        
        expect(({} as any).polluted).toBeUndefined();
        expect(target.polluted).toBeUndefined();
    });
    
    it('should invoke onConflict callback when reserved key is hit', () => {
        const target = { email: 'old@test.com' };
        const src = { email: 'new@test.com' };
        const onConflict = vi.fn();
        
        safeObjectMerge(target, src, { onConflict });
        
        expect(target.email).toBe('old@test.com');
        expect(onConflict).toHaveBeenCalledWith('email', 'new@test.com', 'old@test.com');
    });

    it('should throw in strict mode', () => {
         const target = { email: 'old@test.com' };
         const src = { email: 'new@test.com' };
         
         expect(() => safeObjectMerge(target, src, { mode: 'throw' }))
            .toThrow('Attempted to overwrite reserved key "email"');
    });
});
