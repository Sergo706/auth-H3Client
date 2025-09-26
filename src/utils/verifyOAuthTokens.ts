import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { OidcIdTokenPayload } from '../types/oidc.js'

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
