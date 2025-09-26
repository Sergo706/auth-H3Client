import { decodeProtectedHeader } from 'jose';
import crypto from 'node:crypto';


export function atHashCheck(atHash: string, accessToken: string): boolean {
    const { alg } = decodeProtectedHeader(accessToken);
    if (!alg) return false;

    const bits = parseInt(alg.replace(/^\D+(\d+).*$/, '$1'), 10) || 256;
    const hash = crypto.createHash(`sha${bits}`).update(accessToken, 'ascii').digest();
    const leftHalf = hash.subarray(0, hash.length / 2);
    const calc = leftHalf.toString('base64url');

    if (calc !== atHash) {
      return false;
    }

    return true;
}

