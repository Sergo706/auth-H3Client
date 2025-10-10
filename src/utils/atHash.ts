import { decodeProtectedHeader } from 'jose';
import crypto from 'node:crypto';


export function atHashCheck(atHash: string, accessToken: string, idToken: string): boolean {
    const { alg } = decodeProtectedHeader(idToken);
    if (!alg) return false;

    const bits = parseInt(alg.replace(/^\D+(\d+).*$/, '$1'), 10) || 256;
    const hash = crypto.createHash(`sha${bits}`).update(accessToken, 'ascii').digest();
    const leftHalf = hash.subarray(0, hash.length / 2);
    const expected = leftHalf.toString('base64url');

    const a = Buffer.from(expected, 'base64url');
    const b = Buffer.from(atHash, 'base64url');

    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

