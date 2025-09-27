import type { Configuration } from "../src/types/configSchema.js";

export const config: Configuration = {
    domain: 'http://localhost:3000',
    server: {
        auth_location: {
            serverOrDNS: "10.10.10.10",
            port: 10000
        },
        hmac: {
            enableHmac: true,
            clientId: `strong_and_random_client_id`,
            sharedSecret: `strong_random_cryptography_generated_key`,
        },

    ssl: {
        enableSSL: false,
    },
    cryptoCookiesSecret: `strong_random_cryptography_generated_key`,
    },
    
    telegram: {
        enableTelegramLogger: false,
    },
    logLevel: 'info'
}