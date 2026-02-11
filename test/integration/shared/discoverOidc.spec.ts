import { discoverOidc, getConfiguration } from "@internal/shared";
import { expect, it, describe } from "vitest";

const fakeLogger: any = {
    info: () => {},
    debug: () => {},
    error: () => {},
    child: () => fakeLogger
};

describe('Discover OIDC', () => {
    
    it('Should return the configured oidc .well-known', async () => {
        const {OAuthProviders} = getConfiguration()
        const googleIssuer = OAuthProviders?.find((g) => g.name === 'google');
        expect(googleIssuer?.kind).toBe('oidc')
        expect(googleIssuer).toBeDefined()

        if (googleIssuer && googleIssuer?.kind === 'oidc') {
            const oidcPromise = discoverOidc(googleIssuer.issuer, fakeLogger);
            await expect(oidcPromise).resolves.toHaveProperty('authorization_endpoint');
            await expect(oidcPromise).resolves.toHaveProperty('jwks_uri');
            await expect(oidcPromise).resolves.toHaveProperty('response_types_supported');
            await expect(oidcPromise).resolves.toHaveProperty('token_endpoint_auth_methods_supported');
            await expect(oidcPromise).resolves.toHaveProperty('grant_types_supported');
        }
    })

    it('Should throw on 404 from a valid domain', async () => {
        const invalidUrl = 'https://google.com/not-found123131241241';
        const oidc = discoverOidc(invalidUrl, fakeLogger);
        await expect(oidc).rejects.toThrow(/Discover of oidc failed with status code 404|discovery failed for .*, Unexpected content type/);
    });

    it('Should throw on domain resolution failure', async () => {
        const nonExistentUrl = 'https://invalid1234567890.com';
        const oidc = discoverOidc(nonExistentUrl, fakeLogger);
        await expect(oidc).rejects.toThrow(/fetch failed/);
    });

    it('Should normalize urls', async () => {
        const issuerWithoutSlash = 'https://accounts.google.com';
        const withoutTrailing = discoverOidc(issuerWithoutSlash, fakeLogger);
        await expect(withoutTrailing).resolves.toHaveProperty('issuer');
        const issuerWithSlash = 'https://accounts.google.com/';
        const withTrailing = discoverOidc(issuerWithSlash, fakeLogger);
        await expect(withTrailing).resolves.toHaveProperty('issuer');
    });

    it('Should throw when provided issuer is NOT in the configuration', async () => {
        const unconfiguredIssuer = 'https://login.microsoftonline.com/common/v2.0';
        const oidcPromise = discoverOidc(unconfiguredIssuer, fakeLogger);
        
        await expect(oidcPromise).rejects.toThrow(/^The issuer https:\/\/login\.microsoftonline\.com\/common\/v2\.0 in the configuration is not equal to the discovered one!$/);
    });
});