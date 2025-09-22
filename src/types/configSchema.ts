import * as z from "zod";

export const configurationSchema = z.strictObject({
   server: z.object({
      auth_location: z.object({
         serverOrDNS: z.string(),
         port: z.number()
      }),
      hmac: z.object({
         enableHmac: z.boolean(),
         clientId: z.string(),
         sharedSecret: z.string()
      }),
      ssl: z.object({
         enableSSL: z.boolean(),
         mainDirPath: z.string(),
         rootCertsPath: z.string(),
         clientCertsPath: z.string(),
         clientKeyPath: z.string()
      }),
   }),

   logLevel: z.enum(['debug', 'info', 'warn', 'error', 'fatal'])
}).strict()

export type Configuration = z.infer<typeof configurationSchema>;