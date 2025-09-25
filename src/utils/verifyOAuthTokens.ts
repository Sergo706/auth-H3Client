import { jwtVerify, createRemoteJWKSet } from 'jose';

export async function verifyOAthToken(id_token: string, url: string, issuer: string, clientId: string) {
    const JWKS = createRemoteJWKSet(new URL(url));

  const { payload } = await jwtVerify(id_token, JWKS, {
    issuer: issuer,
    audience: clientId,
  })
    const userInfo = payload;
    return userInfo;
}