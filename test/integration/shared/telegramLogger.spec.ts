import { describe, it, expect } from 'vitest';
import { sendLog } from "@internal/shared";
import { configuration } from "@internal/shared";
import { config } from '../../setup/configs/config.js';

describe('sendLog integration tests', () => {

    it('Should return undefined when enableTelegramLogger is false', async () => {
        const result = await sendLog('Test Title', 'Test Message');
        expect(result).toBeUndefined();
    });

    it('Should properly escape HTML in title and message and attempt real network call', async () => {
        const enabledConfig = { 
            ...config, 
            telegram: { 
                ...config.telegram, 
                enableTelegramLogger: true,
                token: '123456789:INVALID_TOKEN_FORMAT',
                chatId: '123456',
                allowedUser: '123456'
            } 
        };
        configuration(enabledConfig);
        const send = sendLog('<b>Title & More</b>', '<script>alert("XSS")</script>');
        await expect(send).rejects.toBeDefined()
        await expect(send).rejects.toThrow(/401: Bot Token is required/)
    });

    it('Should throw error when token is missing but enabled', async () => {
         const badConfig = { 
            ...config, 
            telegram: { 
                ...config.telegram, 
                enableTelegramLogger: true,
                token: undefined as any,
                chatId: '123456',
                allowedUser: '123456'
            } 
        };

        expect(() => configuration(badConfig)).toThrow(
            /Configuration validation failed[\s\S]*telegram\.token/
        );

    });
});
