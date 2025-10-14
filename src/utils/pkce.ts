import crypto from 'node:crypto'


/**
 * Generates a PKCE verifier/challenge pair for OAuth flows.
 *
 * @returns Object containing the `verifier` and `challenge` strings.
 *
 * @example
 * const { verifier, challenge } = makePkcePair();
 */
export function makePkcePair() {
  const verifier = crypto.randomBytes(64).toString("base64url")
  const challenge = crypto.createHash("sha256").update(verifier).digest('base64url');
  
  return { verifier, challenge }; 
}
