import type { Configuration } from "@internal/shared"
import { githubEmailCallBack } from "./github.callback.js";
import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';

const storage = createStorage({ driver: memoryDriver() });

export const config: Configuration = {
    server: {
        auth_location: {
            serverOrDNS: "127.0.0.1",
            port: 10002
        },
        hmac: {
            enableHmac: true,
            clientId: `1234`,
            sharedSecret: `1234567890`,
        },

    ssl: {
        enableSSL: false,
    },
     cryptoCookiesSecret: `strong_random_cryptography_generated_key`,
   },
    htmlSanitizer: {
        IrritationCount: 50,
        maxAllowedInputLength: 50000
    },
    imageUploader: {
      allowedBytes: 5_000_000,
      allowedMimes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      allowedExtensions: ['png', 'webp', 'jpeg', 'jpg', 'gif']
    },
    uStorage: {
        storage: storage,
        cacheOptions: {
            successTtl: 60 * 60 * 24 * 30,
            rateLimitTtl: 10
        }
    },
    onSuccessRedirect: 'https://share-ad1ae22.com:3000/secret/data',
    OAuthProviders: [{
        kind: 'oidc',
        name: 'google',
        issuer: 'https://accounts.google.com',
        clientId: 'dummy_google_id',
        clientSecret: 'dummy_google_secret',
        defaultScopes: ["openid","email","profile"], 
        extraAuthParams: {
            access_type: "offline",
            prompt: "consent",
            include_granted_scopes: "true"
        },
        redirectUri: "https://share-ad1ae22.com:3000/oauth/callback/google",
        supportPKCE: true,
        redirectUrlOnSuccess: "https://share-ad1ae22.com:3000/secret/data",
        redirectUrlOnError: 'https://share-ad1ae22.com:3000/'
    },
    {
       kind: 'oauth',
       name: 'github',
       authorizationEndpoint: 'https://github.com/login/oauth/authorize',
       tokenEndpoint: 'https://github.com/login/oauth/access_token',
       userInfoEndpoint: 'https://api.github.com/user',
       emailCallBack: githubEmailCallBack,
       clientId: 'dummy_github_id',
       clientSecret: 'dummy_github_secret',
       redirectUri: 'https://share-ad1ae22.com:3000/oauth/callback/github',
       defaultScopes: ['read:user', 'user:email'],
       supportPKCE: true,
       redirectUrlOnSuccess: "https://share-ad1ae22.com:3000/secret/data",
       redirectUrlOnError: 'https://share-ad1ae22.com:3000/'
    },
    {
      kind: 'oauth',
      name: 'x',    
      authorizationEndpoint: 'https://x.com/i/oauth2/authorize',
      tokenEndpoint: 'https://api.x.com/2/oauth2/token',
      userInfoEndpoint: 'https://api.x.com/2/users/me?user.fields=id,is_identity_verified,location,name,verified,confirmed_email,created_at,profile_image_url', 
      clientId: 'dummy_x_id',
      clientSecret: 'dummy_x_secret',
      redirectUri: 'https://share-ad1ae22.com:3000/oauth/callback/x',
      defaultScopes: ["users.email", "users.read", "tweet.read"],
      supportPKCE: true,
      redirectUrlOnSuccess: "https://share-ad1ae22.com:3000/secret/data",
      redirectUrlOnError: 'https://share-ad1ae22.com:3000/'
    },
    {
      kind: 'oauth',
      name: 'linkedin',
      authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
      userInfoEndpoint: 'https://api.linkedin.com/v2/userinfo',
      clientId: 'dummy_linkedin_id',
      clientSecret: 'dummy_linkedin_secret',  
      defaultScopes: ['openid', 'profile', 'email'],
      tokenAuthMethod: 'client_secret_post',
      redirectUri: "https://share-ad1ae22.com:3000/oauth/callback/linkedin",
      supportPKCE: false,
      redirectUrlOnSuccess: "https://share-ad1ae22.com:3000/secret/data",
      redirectUrlOnError: 'https://share-ad1ae22.com:3000/'
    }
],
    enableFireWallBans: false,
    logLevel: 'info'
}
