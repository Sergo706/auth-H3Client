import type { Configuration } from "../../src/types/configSchema.js";
import { githubEmailCallBack } from "./github.callback.js";
import dotenv from 'dotenv'
dotenv.config({ debug: true })

export const config: Configuration = {
    server: {
        auth_location: {
            serverOrDNS: "127.0.0.1",
            port: 10000
        },
        hmac: {
            enableHmac: true,
            clientId: `share-ad1ae22a110a75d207fa6fbbcbc8954c3dedb6191ac8bbe5ac71df293877b93cb13fc5a6e5c914ec5ba0fb6395e1bbb80951fb5be6f572f4ecd34e2a86021bc136fbc3bbf2921c90c1817d1e06d629943a288c04848ff4e291cab2e91f2a704b6c4392b914248593ab5e5f75af936986de6ee8145c0cd793579483fbeed96f341a18b58d968b9ca5d7b4ec44c15536a8d9230e442c8f`,
            sharedSecret: `91fb66849cb3a1e029b4f65f70db8d9eaa58ccd954aadb0b910fc30b05e350da06c64d9d62e1900e8fdca2cfc5d8f09e9d5ffde968ccc1bcc9eb43b92f627ea66cf052e90db3e4318285b3db62c999be98ef48411ed575de8f3e0ccedb57bda0a626fc787d39707ac8df329622adda545d116456ca922fb35eef2835d831cfef848b388ea1f4f9b132d8bc0d6376fb5479158aea72d3e5e223f51733f1a456a23713c398342e6e79c5c1adcb009dad4805880df327f6218f10324ecf0c8ac62c569796dd506a0262c03e4f0db4be6a25d48409082f6f68865120e901aec258c0fd421ec4dd4de8122ac1d48f9ccd6d610b8ea32715140854791867cb623d149edee6bd7db05e92dd1194938b6e5ccbfb3a6669692c686b711c2db2ec38c7491af2436370d7ca4c78f0c24943fe4277b347b93aa9e42991db397b7f4aa2812c6d007cbb9af0f05c78a04449980177dbad906ac98c2434bcf31e571a453c41`,
        },

    ssl: {
        enableSSL: false,
    },
    cryptoCookiesSecret: `strong_random_cryptography_generated_key`,
    },
    onSuccessRedirect: 'https://share-ad1ae22.com:3000/secret/data',
    OAuthProviders: [{
        kind: 'oidc',
        name: 'google',
        issuer: 'https://accounts.google.com',
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
       clientId: process.env.GITHUB_CLIENT_ID!,
       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
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
      clientId: process.env.X_CLIENT_ID!,
      clientSecret: process.env.X_CLIENT_SECRET!,
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
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,  
      defaultScopes: ['openid', 'profile', 'email'],
      tokenAuthMethod: 'client_secret_post',
      redirectUri: "https://share-ad1ae22.com:3000/oauth/callback/linkedin",
      supportPKCE: false,
      redirectUrlOnSuccess: "https://share-ad1ae22.com:3000/secret/data",
      redirectUrlOnError: 'https://share-ad1ae22.com:3000/'
    }
],
    telegram: {
        enableTelegramLogger: false,
    },
    logLevel: 'info'
}
