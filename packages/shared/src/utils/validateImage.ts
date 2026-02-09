import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { sanitizeBaseName } from './sanitizeFileName.js';
import { randomUUID } from 'crypto';
import { getConfiguration } from '../config/config.js';


interface ValidFile {
    ok: true,
    body: Buffer,
    key: string,
    mime: string
}

interface Error  {
    ok: false,
    date: string,
    reason: string,
}

/**
 * 
 * Validates an image buffer against allowed file types and extensions configured in the application.
 * It also processes the image using Sharp to resize and convert it to WebP format.
 *
 * @param {Buffer} data - The raw image buffer to validate.
 * @param {string} filename - The original filename of the image.
 * @returns {Promise<ValidFile | Error>} A promise that resolves to a ValidFile object if successful, or an Error object if validation fails.
 *
 * @example
 * const { ok, body, key, reason } = await validateImage(imageBuffer, 'profile.png');
 * if (!ok) {
 *   console.error('Validation failed:', reason);
 * } else {
 *   console.log('Image processed:', key);
 *   // upload body to storage...
 * }
 */
export async function validateImage(data: Buffer, filename: string): Promise<ValidFile | Error> {
        const buf = data;
        const { imageUploader } = getConfiguration();

        if (buf.byteLength > imageUploader.allowedBytes) {
        return {
            ok: false,
            date: new Date().toISOString(),
            reason: 'File to large'
        };
    }    
    
    const meta = await fileTypeFromBuffer(buf);

    if (!meta) {
        return {
            ok: false,
            date: new Date().toISOString(),
            reason: 'Error validating mime'
        };
    }

    const allowedMime = new Set(imageUploader.allowedMimes);
    const allowedExt = new Set(imageUploader.allowedExtensions);
    
    if (!allowedMime.has(meta.mime) || !allowedExt.has(meta.ext)) {
        return {
            ok: false,
            date: new Date().toISOString(),
            reason: 'Not allowed file type.'
        };
    }

    const cleanBase = sanitizeBaseName(filename, 64);
    const body = await sharp(buf, {
        limitInputPixels: 5000 * 5000,
        failOn: 'truncated'
    })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside' })
    .webp({
        effort: 5
    })
    .toBuffer();

    let key: string;
    if (imageUploader.key) {
        key = `${imageUploader.key()}_${cleanBase}.webp`
    } else {
        key = `${randomUUID()}_${cleanBase}.webp`
    }

    return {
            ok: true,
            body,
            key,
            mime: 'image/webp'
        };
    }