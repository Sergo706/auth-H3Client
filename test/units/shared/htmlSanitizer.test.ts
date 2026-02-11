import { describe, it, expect } from 'vitest';
import { sanitizeInputString } from '@internal/shared';

describe('sanitizeInputString', () => {

    it('should strip simple HTML tags', () => {
        const input = '<script>alert("xss")</script>Hello <b>World</b>';
        const { vall, results } = sanitizeInputString(input);
        
        expect(vall).toBe('Hello World');
        expect(results.htmlFound).toBe(true);
    });

    it('should decode URI encoding and sanitize', () => {
        const input = '%3Cscript%3Ealert(1)%3C/script%3E';
        const { vall, results } = sanitizeInputString(input);
        
        expect(vall).toBe('');
        expect(results.htmlFound).toBe(true);
    })

    it('should strip highly obfuscated XSS payloads', () => {
        const payloads = [
            '<script>alert(1)</script>',
            '<img src=x onerror=alert(1)>',
            '<a href="javascript:alert(1)">click</a>',
            '<iframe src="javascript:alert(1)"></iframe>',
            '<svg/onload=alert(1)>',
            '<p onmouseover="alert(\'xss\')">hover me</p>',
            '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;">link</a>',
        ];
        
        for (const input of payloads) {
            const { vall, results } = sanitizeInputString(input);
            expect(results.htmlFound).toBe(true);
            expect(vall).not.toContain('<script');
            expect(vall).not.toContain('onerror');
            expect(vall).not.toContain('javascript:');
        }
    });

    it('should handle complex deep encoding and URI malformation', () => {
        let deepInput = 'script';
        for (let i = 0; i < 5; i++) {
            deepInput = encodeURIComponent(deepInput);
        }
        const { vall, results } = sanitizeInputString(deepInput);
        expect(results.htmlFound).toBe(false);
        expect(vall).toBe('script');

        const mixedInput = '%3Cscript%3Ehello%E0%A4%A';
        const mixedResult = sanitizeInputString(mixedInput);
        expect(mixedResult.results.htmlFound).toBe(true);
        expect(mixedResult.results.tags?.tagName).toBe('Rejected: Malformed URI');
    });

    it('should enforce maxAllowedInputLength', () => {
        const max = 524288;
        const tooBig = 'a'.repeat(max + 1);
        
        expect(() => sanitizeInputString(tooBig)).toThrow(/Input too large/);
    });

    it('should provide comprehensive sanitization for special characters', () => {
        const input = 'Check out: < > & " \' ` $ { } [ ]';
        const { vall } = sanitizeInputString(input);
        
        expect(vall).toBe('Check out: &amp;lt; &amp;gt; &amp;amp; &quot; &#x27; &#x60; $ { } [ ]');
    });

    it('should handle advanced NFKC normalization and accents', () => {
        const inputs = [
            { raw: 'Ｈｅｌｌｏ', expected: 'Hello' },
            { raw: '¼', expected: '1⁄4' },
            { raw: 'ℌ', expected: 'H' },
            { raw: 'Café', expected: 'Café' },
        ];
        
        for (const { raw, expected } of inputs) {
            const { vall } = sanitizeInputString(raw);
            expect(vall).toBe(expected);
        }
    });

    it('should detect HTML even if buried in other text', () => {
        const input = 'This is a normal sentence. <img src="x" onerror="alert(1)"> And it continues.';
        const { results } = sanitizeInputString(input);
        expect(results.htmlFound).toBe(true);
        expect(results.tags?.tagName).toBe('lenght is !== after a clean.');
    });
});
