import { decodeProtectedHeader } from 'jose';
import crypto from 'node:crypto';


/**
 * Verifies that the `at_hash` claim matches the given access token according to OIDC rules.
 *
 * @param atHash - `at_hash` claim from the ID token.
 * @param accessToken - Access token returned alongside the ID token.
 * @param idToken - Raw ID token, used to inspect the signing algorithm.
 * @returns `true` when the claim matches the access token, otherwise `false`.
 *
 * @example
 * if (!atHashCheck(payload.at_hash, accessToken, idToken)) throw new Error('Mismatch');
 */
export function atHashCheck(atHash: string, accessToken: string, idToken: string): boolean {
    try {
        const { alg } = decodeProtectedHeader(idToken);
        if (!alg) return false;

        const bits = parseInt(alg.replace(/^\D+(\d+).*$/, '$1'), 10) || 256;
        const hash = crypto.createHash(`sha${bits}`).update(accessToken, 'ascii').digest();
        const leftHalf = hash.subarray(0, hash.length / 2);
        const expected = leftHalf.toString('base64url');

        const a = Buffer.from(expected, 'base64url');
        const b = Buffer.from(atHash, 'base64url');

        return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}
