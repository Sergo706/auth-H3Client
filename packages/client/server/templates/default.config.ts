import type { Configuration } from "@internal/shared";
import { useStorage } from "nitropack/runtime/storage";
import crypto from 'node:crypto'

const random = () => crypto.randomBytes(32).toString('hex');
const required = (name: string): string => {
    throw new Error(`Missing required env var: ${name}`);
};
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
    uStorage: {
        storage: useStorage('cache'),
        cacheOptions: {
                successTtl: 60 * 60 * 24 * 30, 
                rateLimitTtl: 10    
        }
    },
    onSuccessRedirect: `/`,
    enableFireWallBans: false,
    htmlSanitizer: {
        IrritationCount: 50,
        maxAllowedInputLength: 50000
    },
    imageUploader: {
        allowedBytes: 5_000_000,
        allowedMimes: ['image/png', 'image/jpeg', 'image/webp'],
        allowedExtensions: ['png', 'webp', 'jpeg', 'jpg']
    },
    telegram: {
        enableTelegramLogger: false as const,
    },
    logLevel: 'info' as const
}