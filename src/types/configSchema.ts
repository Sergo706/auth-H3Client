import * as z from "zod";


export const OAuthProviders = z.array(z.discriminatedUnion("kind", [
   z.object({
      kind: z.literal("oidc"),
      name: z.string(),
      issuer: z.string(),
      clientId: z.string(),
      clientSecret: z.string(),
      defaultScopes: z.array(z.string()).optional(),
      extraAuthParams: z.record(z.string(), z.string()),
      redirectUri: z.url(),  
      redirectUrlOnSuccess: z.url({protocol:  /^https?$/}),
      redirectUrlOnError: z.url({protocol:  /^https?$/}),
   }),
   z.object({
      kind: z.literal("oauth"),
      name: z.string(),
      authorizationEndpoint: z.url(), 
      tokenEndpoint: z.url(),          
      userInfoEndpoint: z.url(), 
      clientId: z.string(),
      clientSecret: z.string(),
      redirectUri: z.url(),  
      defaultScopes: z.array(z.string()).optional(),
      supportPKCE: z.boolean(),
      redirectUrlOnSuccess: z.url({protocol:  /^https?$/}),
      redirectUrlOnError: z.url({protocol:  /^https?$/}),
   })
   ]
)).optional()

export const configurationSchema = z.strictObject({
   domain: z.string(),
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

   OAuthProviders,

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

export type Configuration = z.infer<typeof configurationSchema>;
export type OAuthProviders = z.infer<typeof OAuthProviders>