import * as z from "zod";
import type { Storage } from 'unstorage';

type EmailCB = (accessToken: string) => Promise<string>;
type ExtraCB = (accessToken: string) => Promise<Record<string, unknown>>;
const emailCB = z.custom<EmailCB>((v) => typeof v === "function");
const extraCB = z.custom<ExtraCB>((v) => typeof v === "function");

export const OAuthProviders = z.array(z.discriminatedUnion("kind", [
   z.object({
      kind: z.literal("oidc"),
      name: z.string(),
      issuer: z.url(),
      clientId: z.string(),
      clientSecret: z.string(),
      defaultScopes: z.array(z.string()).optional(),
      extraAuthParams: z.record(z.string(), z.string()).optional(),
      tokenAuthMethod: z.enum(["client_secret_basic","client_secret_post"]).optional(),
      redirectUri: z.url(),  
      supportPKCE: z.boolean(),
      redirectUrlOnSuccess: z.url({protocol:  /^https?$/}),
      redirectUrlOnError: z.url({protocol:  /^https?$/}),
   }),
   z.object({
      kind: z.literal("oauth"),
      name: z.string(),
      authorizationEndpoint: z.url(), 
      tokenEndpoint: z.url(),          
      userInfoEndpoint: z.url(), 
      emailCallBack: emailCB.optional(),
      extraUserInfoCallBacks: z.array(extraCB).optional(), 
      clientId: z.string(),
      clientSecret: z.string(),
      tokenAuthMethod: z.enum(["client_secret_basic","client_secret_post"]).optional(),
      redirectUri: z.url(),  
      defaultScopes: z.array(z.string()).optional(),
      extraAuthParams: z.record(z.string(), z.string()).optional(),
      supportPKCE: z.boolean(),
      redirectUrlOnSuccess: z.url({protocol:  /^https?$/}),
      redirectUrlOnError: z.url({protocol:  /^https?$/}),
   })
   ]
)).optional()


export const sharedSettings = z.strictObject({
   domain: z.string(),
   accessTokenTTL: z.number(),
})

export const configurationSchema = z.strictObject({
   server: z.object({
      auth_location: z.object({
         serverOrDNS: z.string(),
         port: z.number()
      }),
      hmac: z.discriminatedUnion('enableHmac', [
         z.object({
            enableHmac: z.literal(false),
            clientId: z.string().optional(),
            sharedSecret: z.string().optional()
         }),
         z.object({
            enableHmac: z.literal(true),
            clientId: z.string(),
            sharedSecret: z.string()
         }),
      ]),

      ssl: z.discriminatedUnion('enableSSL', [
         z.object({
         enableSSL: z.literal(true),
         mainDirPath: z.string(),
         rootCertsPath: z.string(),
         clientCertsPath: z.string(),
         clientKeyPath: z.string()
      }),
         z.object({
            enableSSL: z.literal(false),
            mainDirPath: z.string().optional(),
            rootCertsPath: z.string().optional(),
            clientCertsPath: z.string().optional(),
            clientKeyPath: z.string().optional()
       }) 
      ]),
      cryptoCookiesSecret: z.string()
   }),
   uStorage: z.object({
      storage: z.custom<Storage>((val) => {
         return val !== null &&
                typeof val === 'object' &&
                typeof (val as Storage).getItem === 'function' &&
                typeof (val as Storage).setItem === 'function';
                
      }, { message: 'Must be a valid unstorage Storage instance' }),
      cacheOptions: z.object({
           successTtl: z.number().default(60 * 60 * 24 * 30),
           rateLimitTtl: z.number().default(10),
      }).optional()
   }),
   onSuccessRedirect: z.url(),
   OAuthProviders,
   enableFireWallBans: z.boolean(),
   telegram: z.discriminatedUnion("enableTelegramLogger", [
      z.object({
      enableTelegramLogger: z.literal(false),
      token: z.string().optional(),
      chatId: z.string().optional(),
      allowedUser: z.string().optional()
   }),
   z.object({
      enableTelegramLogger: z.literal(true),
      token: z.string(),
      chatId: z.string(),
      allowedUser: z.string()
   }),
]),
   logLevel: z.enum(['debug', 'info', 'warn', 'error', 'fatal'])
}).strict()

export type RemoteConfig = z.infer<typeof sharedSettings>;
export type Configuration = z.infer<typeof configurationSchema>;
export type OAuthProviders = z.infer<typeof OAuthProviders>