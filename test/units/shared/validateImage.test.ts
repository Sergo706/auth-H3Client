import { describe, it, expect } from 'vitest';
import { validateImage } from '@internal/shared';
import sharp from 'sharp';

describe('validateImage (Rigor)', () => {
    const validPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

    const validGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

    it('should reject files that are too large (25MB check)', async () => {
        const largeBuf = Buffer.alloc(1024 * 1024 * 25);
        const result = await validateImage(largeBuf, 'large.png');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('File to large');
        }
    });

    it('should reject invalid and dangerous file content', async () => {
        const payloads = [
            { buf: Buffer.from('not an image'), name: 'test.txt' },
            { buf: Buffer.from('<?php phpinfo(); ?>'), name: 'malicious.php' },
            { buf: Buffer.alloc(100), name: 'empty.bin' }
        ];
        
        for (const { buf, name } of payloads) {
            const result = await validateImage(buf, name);
            expect(result.ok).toBe(false);
        }
    });

    it('should validate and process diverse valid image formats', async () => {
        const formats = [
            { buf: validPng, name: 'image.png' },
            { buf: validGif, name: 'image.gif' }
        ];
        
        for (const { buf, name } of formats) {
            const result = await validateImage(buf, name);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.mime).toBe('image/webp');
                expect(result.key).toContain('.webp');
                
                const metadata = await sharp(result.body).metadata();
                expect(metadata.format).toBe('webp');
            }
        }
    });

    it('should handle filenames with special characters and normalize them in the key', async () => {
        const result = await validateImage(validPng, 'My Awesome Image!.png');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.key).toContain('my-awesome-image.webp');
        }
    });
});
