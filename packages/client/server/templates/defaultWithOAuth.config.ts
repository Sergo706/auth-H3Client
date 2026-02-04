import type { Configuration } from "@internal/shared";
import { useStorage } from "nitropack/runtime/storage";
import crypto from 'node:crypto'
import { githubEmailCallBack } from "./callbacks/github.callback.js";

export const domain = process.env.NODE_ENV === 'development' ? 'localhost' : process.env.DOMAIN;

const random = () => crypto.randomBytes(32).toString('hex');

const required = (name: string): string => {
    throw new Error(`Missing required env var: ${name}`);
};

const baseUrl = process.env.BASEURL ?? required('BASEURL, example: http://example.com')
export const configDefaults: Configuration = {
    server: {
        auth_location: {
            serverOrDNS: process.env.AUTH_SERVER_LOCATION || required('AUTH_SERVER_LOCATION'),
            port: Number(process.env.AUTH_PORT_LOCATION || required('AUTH_PORT_LOCATION'))
        },
        hmac: {
            enableHmac: true as const,
            clientId: process.env.HMAC_CLIENT_ID ?? random(),
            sharedSecret: process.env.HMAC_SHARED_SECRET ?? random(),
        },

    ssl: {
        enableSSL: false as const,
    },

    cryptoCookiesSecret: process.env.AUTH_CRYPTO_COOKIES ?? random(),
    },
    htmlSanitizer: {
        IrritationCount: 50,
        maxAllowedInputLength: 50000
    },
    imageUploader: {
        allowedBytes: 5_000_000,
        allowedMimes: ['image/png', 'image/jpeg', 'image/webp'],
        allowedExtensions: ['png', 'webp', 'jpeg', 'jpg']
    },
    uStorage: {
        storage: useStorage('cache'),
        cacheOptions: {
                successTtl: 60 * 60 * 24 * 30, 
                rateLimitTtl: 10    
        }
    },
    onSuccessRedirect: `/`,
    enableFireWallBans: false,
    telegram: {
        enableTelegramLogger: false as const,
    },
    logLevel: 'info' as const,
    OAuthProviders: [{
        kind: 'oidc',
        name: 'google',
        issuer: 'https://accounts.google.com',
        clientId: process.env.OAUTH_GOOGLE_CLIENT_ID || required('OAUTH_GOOGLE_CLIENT_ID'),
        clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET || required('OAUTH_GOOGLE_CLIENT_SECRET'),
        defaultScopes: ["openid","email","profile"], 
        extraAuthParams: {
            access_type: "offline",
            prompt: "consent",
            include_granted_scopes: "true"
        },
        redirectUri: `${baseUrl}/oauth/callback/google`,
        supportPKCE: true,
        redirectUrlOnSuccess: `${baseUrl}/secret/data`,
        redirectUrlOnError: `${baseUrl}/`
    },
    {
       kind: 'oauth',
       name: 'github',
       authorizationEndpoint: 'https://github.com/login/oauth/authorize',
       tokenEndpoint: 'https://github.com/login/oauth/access_token',
       userInfoEndpoint: 'https://api.github.com/user',
       emailCallBack: githubEmailCallBack,
       clientId: process.env.OAUTH_GITHUB_CLIENT_ID || required('OAUTH_GITHUB_CLIENT_ID'),
       clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET || required('OAUTH_GITHUB_CLIENT_SECRET'),
       redirectUri: `${baseUrl}/oauth/callback/github`,
       defaultScopes: ['read:user', 'user:email'],
       supportPKCE: true,
       redirectUrlOnSuccess: `${baseUrl}/secret/data`,
       redirectUrlOnError: `${baseUrl}/`
    },
    {
      kind: 'oauth',
      name: 'x',    
      authorizationEndpoint: 'https://x.com/i/oauth2/authorize',
      tokenEndpoint: 'https://api.x.com/2/oauth2/token',
      userInfoEndpoint: 'https://api.x.com/2/users/me?user.fields=id,is_identity_verified,location,name,verified,confirmed_email,created_at,profile_image_url', 
      clientId: process.env.OAUTH_X_CLIENT_ID  || required('OAUTH_X_CLIENT_ID'),
      clientSecret: process.env.OAUTH_X_CLIENT_SECRET  || required('OAUTH_X_CLIENT_SECRET'),
      redirectUri: `${baseUrl}/oauth/callback/x`,
      defaultScopes: ["users.email", "users.read", "tweet.read"],
      supportPKCE: true,
      redirectUrlOnSuccess: `${baseUrl}/secret/data`,
      redirectUrlOnError: `${baseUrl}/`
    },
    {
      kind: 'oauth',
      name: 'linkedin',
      authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
      userInfoEndpoint: 'https://api.linkedin.com/v2/userinfo',
      clientId: process.env.OAUTH_LINKEDIN_CLIENT_ID || required('OAUTH_LINKEDIN_CLIENT_ID'),
      clientSecret: process.env.OAUTH_LINKEDIN_CLIENT_SECRET  || required('OAUTH_LINKEDIN_CLIENT_SECRET'),  
      defaultScopes: ['openid', 'profile', 'email'],
      tokenAuthMethod: 'client_secret_post',
      redirectUri: `${baseUrl}/oauth/callback/linkedin`,
      supportPKCE: false,
      redirectUrlOnSuccess: `${baseUrl}/secret/data`,
      redirectUrlOnError: `${baseUrl}/`
    }
],
}