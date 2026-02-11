import { describe, it, expect } from 'vitest';
import { makeSafeString } from '@internal/shared';

describe('makeSafeString', () => {

    it('should validate min/max length boundaries', () => {
        const schema = makeSafeString({ min: 5, max: 10 });
        
        expect(schema.safeParse('12345').success).toBe(true);
        expect(schema.safeParse('1234').success).toBe(false);
        expect(schema.safeParse('1234567890').success).toBe(true);
        expect(schema.safeParse('12345678901').success).toBe(false);
    });

    it('should handle extremely long strings and reject them if they exceed max', () => {
        const max = 1000;
        const schema = makeSafeString({ min: 1, max });
        
        const longValid = 'a'.repeat(max);
        const tooLong = 'a'.repeat(max + 1);
        
        expect(schema.safeParse(longValid).success).toBe(true);
        expect(schema.safeParse(tooLong).success).toBe(false);
    });

    it('should validate complex regex patterns', () => {
        const schema = makeSafeString({ 
            min: 1, 
            max: 50, 
            pattern: /^[a-z]+_[0-9]{4}$/, 
            patternMsg: 'Must be name_year format' 
        });
        
        expect(schema.safeParse('sergio_2026').success).toBe(true);
        expect(schema.safeParse('sergio2026').success).toBe(false);
        expect(schema.safeParse('SERGIO_2026').success).toBe(false);
        expect(schema.safeParse('sergio_abcd').success).toBe(false);
    });

    it('should reject various HTML payloads', () => {
        const schema = makeSafeString({ min: 1, max: 200 });
        
        const payloads = [
            '<script>alert(1)</script>',
            '<img src=x onerror=alert(1)>',
            '<a href="javascript:alert(1)">click</a>',
            '<iframe src="javascript:alert(1)"></iframe>',
            '<svg/onload=alert(1)>',
            '<details open ontoggle=alert(1)>',
            '<!--<script>--><script>alert(1)</script>',
            '<<script>alert(1)</script>'
        ];
        
        for (const payload of payloads) {
            const result = schema.safeParse(payload);
            expect(result.success, `Expected to reject: ${payload}`).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('HTML found in input');
            }
        }
    });

    it('should allow strings that look like HTML but aren\'t', () => {
        const schema = makeSafeString({ min: 1, max: 100 });
        
        const safeStrings = [
            '1 < 2 and 3 > 4',
            'This is a "quoted" string',
            'Price is $10.00',
            'Formula: a < b + c',
            'Check out this -> arrow',
        ];
        
        for (const str of safeStrings) {
            expect(schema.safeParse(str).success, `Expected to allow: ${str}`).toBe(true);
        }
    });

    it('should transform output and apply double-escaping for ampersands', () => {
        const schema = makeSafeString({ min: 1, max: 100 });
        
        const input = 'Auth & Security "Best" Practices';
        const result = schema.safeParse(input);
        
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBe('Auth &amp;amp; Security &quot;Best&quot; Practices');
        }
    });
});
