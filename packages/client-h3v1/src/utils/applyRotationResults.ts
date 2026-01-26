import { appendHeader, deleteCookie, H3Event } from "h3";
import { makeCookie } from './cookieGenerator.js'
import type { RotationResult, AccessRotationResult, RefreshRotationResult, RotationSuccess, AccessRotationSuccess, RefreshRotationSuccess } from "@internal/shared";

type AnyRotationResult = RotationResult | AccessRotationResult | RefreshRotationResult;

export function applyRotationResult(
    event: H3Event,
    result: AnyRotationResult,
    domain: string,
    accessTokenTTL: number
): AnyRotationResult {

    if (!result) return undefined;

    if ('error' in result || 'text' in result) {
        return result;
    }

    switch (result.type) {
        case 'access':
            applyAccessRotation(event, result, domain, accessTokenTTL);
            break;
        case 'refresh':
            applyRefreshRotation(event, result, domain);
            break;
        case 'both':
            applyBothRotation(event, result, domain, accessTokenTTL);
            break;
    }

    return undefined;
}

function applyAccessRotation(
    event: H3Event,
    result: AccessRotationSuccess,
    domain: string,
    accessTokenTTL: number
): void {
    const { newToken, accessIat } = result;

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

    event.context.accessToken = newToken;
}

function applyRefreshRotation(
    event: H3Event,
    result: RefreshRotationSuccess,
    domain: string
): void {
    const { newRefresh, rawSetCookie } = result;

    // deleteCookie(event, 'session', { domain, path: '/' });
    // deleteCookie(event, 'iat', { domain, path: '/' });
    
    rawSetCookie.forEach(line => appendHeader(event, 'Set-Cookie', line));

    event.context.session = newRefresh;
}

function applyBothRotation(
    event: H3Event,
    result: RotationSuccess,
    domain: string,
    accessTokenTTL: number
): void {
    const { newToken, newRefresh, accessIat, rawSetCookie } = result;

    // deleteCookie(event, 'session', { domain, path: '/' });
    // deleteCookie(event, 'iat', { domain, path: '/' });
    rawSetCookie.forEach(line => appendHeader(event, 'Set-Cookie', line));

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
}

