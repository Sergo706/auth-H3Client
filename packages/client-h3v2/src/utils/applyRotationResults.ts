import { deleteCookie, H3Event } from "h3";
import { makeCookie } from './cookieGenerator.js'

export interface RotationSuccess {
    newToken: string;
    newRefresh: string;
    accessIat: string;
    rawSetCookie: string[];
}

export interface RotationError {
    error: string;
}

export interface RotationMfa {
    text: string;
    message: string;
}

export type RotationResult = RotationSuccess | RotationError | RotationMfa | undefined;

export function applyRotationResult(
    event: H3Event,
    result: RotationResult,
    domain: string,
    accessTokenTTL: number
): RotationResult {
    if (!result) return undefined;

    if ('error' in result || 'text' in result) {
        return result;
    }

    const { newToken, newRefresh, accessIat, rawSetCookie } = result;

    deleteCookie(event, 'session', { domain, path: '/' });
    deleteCookie(event, 'iat', { domain, path: '/' });
    
    rawSetCookie.forEach(line => 
            event.res.headers.append('Set-Cookie', line)
    );

    makeCookie(event, '__Secure-a', newToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: true,
        path: '/',
        domain,
        maxAge: accessTokenTTL
    });
    makeCookie(event, 'a-iat', accessIat, {
        httpOnly: true,
        sameSite: 'strict',
        secure: true,
        path: '/',
        domain,
        maxAge: accessTokenTTL
    });

    event.context.session = newRefresh;
    event.context.accessToken = newToken;

    return undefined;
}