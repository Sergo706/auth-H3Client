import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { OidcIdTokenPayload } from '../types/oidc.js'

/**
 * Verifies an OIDC ID token using the provider's JWKS endpoint and returns the decoded payload.
 *
 * @param id_token - Raw ID token string to verify.
 * @param url - JWKS endpoint used to resolve signing keys.
 * @param issuer - Expected issuer value.
 * @param clientId - Client ID expected in the audience claim.
 * @returns Decoded payload when verification succeeds.
 *
 * @example
 * const payload = await verifyOAuthToken(idToken, jwksUrl, issuer, clientId);
 */
export async function verifyOAuthToken(
  id_token: string,
  url: string,
  issuer: string,
  clientId: string
): Promise<OidcIdTokenPayload> {
  const JWKS = createRemoteJWKSet(new URL(url));

  const { payload } = await jwtVerify(id_token, JWKS, {
    issuer: issuer,
    audience: clientId,
    clockTolerance: 5
  })
  return payload as OidcIdTokenPayload;
}
