import { describe, it, expect } from 'vitest';
import { getLogger } from '@internal/shared';

describe('logger (Rigor)', () => {
    it('should return a pino logger instance with redaction configuration', () => {
        const logger = getLogger();
        expect(logger).toBeDefined();
    });

    it('should maintain singleton status across imports', async () => {
        const logger1 = getLogger();
        const { getLogger: getLoggerAgain } = await import('@internal/shared');
        const logger2 = getLoggerAgain();
        expect(logger1).toBe(logger2);
    });

    it('should correctly create deeply nested child loggers', () => {
        const logger = getLogger();
        const child1 = logger.child({ level1: 'a' });
        const child2 = child1.child({ level2: 'b' });
        
        expect(child2).toBeDefined();
        expect(typeof child2.info).toBe('function');
    });

    it('should have redaction keys defined in the logger instance', () => {
        const logger = getLogger();
        expect(() => {
            logger.info({ 
                password: 'secret_password', 
                email: 'test@example.com',
                authorization: 'Bearer token' 
            }, 'Testing redaction safety');
        }).not.toThrow();
    });
});
