import * as z from "zod";

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