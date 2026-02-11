import { describe, it, expect } from 'vitest';
import { sanitizeBaseName, fileNameSchema } from '@internal/shared';

describe('sanitizeBaseName', () => {

    it('should aggressively remove path traversal attempts', () => {
        const traverals = [
            '../../etc/passwd',
            '..\\..\\windows\\system32\\config',
            '/absolute/path/to/file.txt',
            'C:\\harddrive\\secrets.docx',
            '....//....//etc/passwd',
            '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        ];
        
        for (const input of traverals) {
            const result = sanitizeBaseName(input, 100);
            expect(result).not.toContain('/');
            expect(result).not.toContain('\\');
        }
    });

    it('should handle complex multiple extensions and dots', () => {
        expect(sanitizeBaseName('archive.tar.gz', 50)).toBe('archive.tar');
    });

    it('should normalize and slugify complex unicode names', () => {
        const inputs = [
            { raw: 'Möbel.txt', expected: 'mobel' },
            { raw: '北京.png', expected: 'file' },
            { raw: 'My Awesome Photo! (2026).jpg', expected: 'my-awesome-photo-2026' },
            { raw: 'Draft_v1.2.3.docx', expected: 'draft_v1.2.3' },
        ];
        
        for (const { raw, expected } of inputs) {
            expect(sanitizeBaseName(raw, 50)).toBe(expected);
        }
    });

    it('should handle lengths correctly', () => {
        const longName = 'a'.repeat(100) + '.txt';
        expect(sanitizeBaseName(longName, 10)).toBe('aaaaaaaaaa');
        expect(sanitizeBaseName(longName, 5)).toBe('aaaaa');
    });

    it('should return "file" when entire input is stripped', () => {
        expect(sanitizeBaseName('!!!!', 10)).toBe('file');
        expect(sanitizeBaseName('      ', 10)).toBe('file');
        expect(sanitizeBaseName('[]{}()', 10)).toBe('file');
    });
});

describe('fileNameSchema (Rigor)', () => {
    it('should fail on any illegal character or HTML', () => {
        const badInputs = [
            'my file.txt',
            'my/file.txt',
            'my<file>.txt',
            'my\0file.txt', 
            'my\nfile.txt', 
        ];
        
        for (const input of badInputs) {
            expect(fileNameSchema.safeParse(input).success, `Should reject: ${JSON.stringify(input)}`).toBe(false);
        }
    });

    it('should accept valid clean filenames', () => {
        const goodInputs = [
            'image.png',
            'Archive.Tar.Gz',
            'user-profile_2026.meta',
            'README.md',
        ];
        
        for (const input of goodInputs) {
            expect(fileNameSchema.safeParse(input).success, `Should allow: ${input}`).toBe(true);
        }
    });
});
