import * as z from "zod";
import type { Storage } from 'unstorage';

type EmailCB = (accessToken: string) => Promise<string>;
type ExtraCB = (accessToken: string) => Promise<Record<string, unknown>>;
const emailCB = z.custom<EmailCB>((v) => typeof v === "function");
const extraCB = z.custom<ExtraCB>((v) => typeof v === "function");

/**
 * Schema for defining OAuth/OIDC providers.
 * Supports both generic OAuth2 and OIDC (OpenID Connect) providers with auto-discovery.
 */
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


/**
 * Settings shared between the client and the auth server.
 * These are typically fetched remotely by the client.
 */
export const sharedSettings = z.strictObject({
   /** The domain validation for cookies (e.g., ".example.com") */
   domain: z.string(),
   /** Access token time-to-live in milliseconds */
   accessTokenTTL: z.number(),
})

/**
 * The main configuration schema for the Auth Client.
 * All options required to run the client-side middleware and utilities.
 */
export const configurationSchema = z.strictObject({
   /** Server connection and security settings */
   server: z.object({
      /** Location of the upstream Auth Server */
      auth_location: z.object({
         /** Hostname or DNS of the auth server */
         serverOrDNS: z.string(),
         /** Port number of the auth server */
         port: z.number()
      }),
      /** HMAC signature settings for request integrity */
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

      /**
       * SSL/TLS configuration for secure communication.
       * Required if the Auth Server uses self-signed certs or client certificate authentication.
       */
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
      /**
       * Secret used for signing/encrypting cookies.
       * Must match the server's secret.
       */
      cryptoCookiesSecret: z.string()
   }),
    htmlSanitizer: z.object({
      /** 
       * The number of time to run the sanitizer in a loop before breaking.
       * keep number high but not to high to prevent ddos.
       * default 50
       * */
      IrritationCount: z.number().default(50),
      /**
       * The max allowed input length for the sanitizer to process.
       * If the input is larger than this, it will be rejected.
       * default 50000
       */
      maxAllowedInputLength: z.number().default(50000)
   }).default({
      IrritationCount: 50,
      maxAllowedInputLength: 50000
   }),
   imageUploader:  z.object({
      /**
       * Max allowed file size in bytes.
       * Default: 5MB (5_000_000)
       */
      allowedBytes: z.number().default(5_000_000),
      /**
       * List of allowed MIME types.
       * Default: ['image/png', 'image/jpeg', 'image/webp']
       */
      allowedMimes: z.array(z.string()).default(['image/png', 'image/jpeg', 'image/webp']),
      /**
       * List of allowed file extensions.
       * Must match the allowed MIME types for strict validation.
       * Default: ['png', 'webp', 'jpeg', 'jpg']
       */
      allowedExtensions: z.array(z.string()).default(['png', 'webp', 'jpeg', 'jpg']),
      /**
       * Optional function to generate custom filenames (keys).
       * If omitted, a random UUID will be used.
       * @example (input) => `my-folder/${input.id}`
       */
      key: z.function({input: z.any(), output: z.string()}).optional()
   }).default({
      allowedBytes: 5_000_000,
      allowedMimes: ['image/png', 'image/jpeg', 'image/webp'],
      allowedExtensions: ['png', 'webp', 'jpeg', 'jpg']
   }),
   /**
    * Unified storage configuration for caching and session data.
    * Uses `unstorage` drivers (Redis, FS, Memory, etc.).
    */
   uStorage: z.object({
      /** The unstorage instance */
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
   /** URL to redirect the user to after a successful login */
   onSuccessRedirect: z.url(),
   /** List of OAuth providers (optional) */
   OAuthProviders,
   magicLinkRedirectPath: z.string().default('/auth/verify'),
   /** Whether to enable automatic banning of suspicious IPs (requires server support) */
   enableFireWallBans: z.boolean(),
   /**
    * Telegram notification settings.
    * Useful for receiving real-time security alerts (e.g., bans, errors).
    */
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
   /** Minimum logging level for the client logger */
   logLevel: z.enum(['debug', 'info', 'warn', 'error', 'fatal'])
}).strict()

export type RemoteConfig = z.infer<typeof sharedSettings>;
export type Configuration = z.infer<typeof configurationSchema>;
export type OAuthProviders = z.infer<typeof OAuthProviders>