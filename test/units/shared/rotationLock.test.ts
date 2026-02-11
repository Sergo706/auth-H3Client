import { test, describe, expect } from 'vitest';
import { safeAction } from '@internal/shared';

const fakeLogger: any = {
    info: () => {},
    debug: () => {},
    error: () => {},
    child: () => fakeLogger
};

describe('promiseLocker', () => {
    test('executes action', async () => {
        const result = await safeAction('token1', async () => 'success', fakeLogger);
        expect(result).toBe('success');
    });

    test('deduplicates concurrent calls', async () => {
        let calls = 0;
        const action = async () => {
            calls++;
            await new Promise(resolve => setTimeout(resolve, 50));
            return 'result';
        };

        const [r1, r2] = await Promise.all([
            safeAction('token2', action, fakeLogger),
            safeAction('token2', action, fakeLogger)
        ]);

        expect(calls).toBe(1)
        expect(r1).toBe('result')
        expect(r2).toBe('result')
    });

    test('stress test', async () => {
        let calls = 0;
        const token = 'token-concurrent';
        const action = async () => {
            calls++;
            await new Promise(resolve => setTimeout(resolve, 50));
            return 'result';
        };

         const results = await Promise.all(
            Array.from({ length: 150 }).map(() => safeAction(token, action))
        );
        expect(calls).toBe(1)
    })  

    test('should deduplicate concurrent async actions and provide identical data', async () => {
        let executionCount = 0;
        const token = `token-concurrent-${Date.now()}`;

        const action = async () => {
            executionCount++;
            await new Promise(resolve => setTimeout(resolve, 200));
            return { timestamp: Date.now(), id: Math.random() };
        };

        const results = await Promise.all(
            Array.from({ length: 20 }).map(() => safeAction(token, action))
        );

        expect(executionCount).toBe(1);
        
        const firstResult = results[0];
        results.forEach(res => {
            expect(res).toBe(firstResult);
            expect(res.timestamp).toBe(firstResult.timestamp);
        });
    });

    test('uses cache for subsequent calls', async () => {
        let calls = 0;
        const data = { timestamp: Date.now(), id: Math.random() };
        const action = async () => {
            calls++;
            return data;
        };

        await safeAction('token3', action, fakeLogger);
        const r2 = await safeAction('token3', action, fakeLogger);

        expect(calls).toBe(1);
        expect(r2).toBe(data)
    });

    test('releases lock on error', async () => {
        let calls = 0;
        const action = async () => {
            calls++;
            throw new Error('fail');
        };


        await expect(async () => {
            await safeAction('token_error', action, fakeLogger);
        }).rejects.toThrow(/fail/);

        
        let calls2 = 0;
        const action2 = async () => {
            calls2++;
            return 'success';
        };

        const result = await safeAction('token_error', action2, fakeLogger);
        expect(result).toBe('success');
        expect(calls2).toBe(1);
    });
    
    test('respects cache ttl', async () => {
         let calls = 0;
         const action = async () => {
             calls++;
             return 'cached';
         };
         
         await safeAction('token_ttl', action, fakeLogger); 
         await safeAction('token_ttl', action, fakeLogger); 
         expect(calls).toBe(1);
         
         await new Promise(resolve => setTimeout(resolve, 100));
         
         await safeAction('token_ttl', action, fakeLogger);
         expect(calls).toBe(2);
    });
});