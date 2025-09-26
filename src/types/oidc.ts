import type { JWTPayload } from 'jose'
export interface OidcIdTokenPayload extends JWTPayload {
sub: string
nonce?: string
azp?: string
at_hash?: string
email?: string
name?: string
picture?: string
}