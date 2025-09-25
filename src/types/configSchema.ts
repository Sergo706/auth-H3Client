import * as z from "zod";

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

   OAuthProviders: z.array(z.object({
      name: z.string(),
      clientId: z.string(),
      clientSecret: z.string(),
      providerUrlToRedirect: z.url({protocol:  /^https$/}),
      redirectUrlOnSuccess: z.url({protocol:  /^https?$/}),
      redirectUrlOnError: z.url({protocol:  /^https?$/}),
      exchangeCodeUrl: z.url({protocol:  /^https?$/}),
      verificationUrl: z.url(),
      issuer: z.array(z.string())
   }).optional()),

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