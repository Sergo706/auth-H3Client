import { type EventHandler, type EventHandlerRequest, defineEventHandler, getCookie } from 'h3';
import { safeAction } from '@internal/shared';

/**
 *  A wrapper that serializes concurrent requests for the same user.
 * 
 * Prevents race conditions by ensuring multiple requests from the same user run sequentially
 * rather than in parallel. Useful for critical actions like payments, inventory updates, or
 * token rotation where simultaneous execution could cause data inconsistency.
 *
 * **Locking Mechanism:**
 * Uses the first available identifier to lock execution:
 * 1. `lockKey` (custom override)
 * 2. `session` cookie (authenticated user)
 * 3. `__Secure-a` access token (authenticated user)
 * 4. `canary_id` (anonymous visitor)
 * 
 * If a request is already running for the identified user, subsequent requests will wait
 * until the first one completes. Requests from *different* users run in parallel as normal.
 *
 * @param handler - The H3 event handler to wrap.
 * @param lockKey - Optional custom key to force specific locking group (e.g. 'global-maintenance').
 * @returns An event handler that automatically manages concurrency locking.
 */
export const defineDeduplicatedEventHandler = <T extends EventHandlerRequest, D>(
      handler: EventHandler<T, D>,
      lockKey?: string
    ): EventHandler<T, Promise<D> | D> => { 
        return defineEventHandler<T>(async (event) => {
            const session = getCookie(event, 'session');
            const token = getCookie(event, '__Secure-a');
            const canary = getCookie(event, 'canary_id');

            const key = lockKey || session || token || canary || 'anon';

            if (key !== 'anon') {
                return await safeAction(key, async () => {
                    return await handler(event);
                });
            }

            return await handler(event);
        });
    }