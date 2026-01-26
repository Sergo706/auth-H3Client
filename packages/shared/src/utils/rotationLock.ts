import { getLogger } from "@internal/shared";

const rotationLocks = new Map<string, Promise<any>>();
const recentResults = new Map<string, any>();

/**
 * This code implements a deduplication and caching mechanism for async actions, preventing duplicate concurrent operations with the same token. 

### Key Components

Two Maps:

- rotationLocks - Tracks in-progress operations by storing their promises
- recentResults - Caches completed results for 3 seconds

### Flow Logic

Check cache first - If result exists in recentResults, return it immediately (avoids re-execution)

Wait for in-progress action - If another caller is already executing this action (lock exists), wait for that promise to complete and return its result

Execute as leader - If no lock exists:

    - Execute the action
    - Store the promise in rotationLocks (so other callers can wait)
    - Cache the result in recentResults for 3 seconds
    - Clean up the lock in finally block

This pattern is ideal for token rotation or similar operations where:

    - Multiple concurrent requests might trigger the same expensive operation
    - You want only ONE actual execution (the "leader")
    - Other requests should wait and reuse the same result
    - Recent results can be safely reused for a short window

 * @example Promise.all([
  safeAction('token123', rotateToken),  // Executes (leader)
  safeAction('token123', rotateToken),  // Waits for leader
  safeAction('token123', rotateToken),  // Waits for leader
]);
// Result: Only 1 actual rotation happens, all get same result

 * @param token The key to be used for locking
 * @param action the async action to be locked
 * @param recentResultsTTL Caches completed results TTL to return default 3000 (3sec)
 * @returns the resolved or cached action
 */
export async function safeAction<T>(token: string, action: () => Promise<T>, recentResultsTTL = 3000): Promise<T> {
    const log = getLogger().child({service: 'auth-client', branch: 'utils', type: 'safeAction'});
 
    if (recentResults.has(token)) {
        return recentResults.get(token) as T;
    }

    if (rotationLocks.has(token)) {
       
        const result = await rotationLocks.get(token);
        
         if (recentResults.has(token)) {
             return recentResults.get(token) as T;
         }
         return result as T;
    }
    
    log.info('No lock/cache found. Becoming leader.');
    const promise = action();
    rotationLocks.set(token, promise);

    try {
        const result = await promise;
        log.info({PromiseResults: result})
        recentResults.set(token, result);
        log.info('Action succeeded. Caching result.');
        
        setTimeout(() => {
            recentResults.delete(token);
            log.info('Cache expired.'); 
        }, recentResultsTTL);

        return result;

   } finally {
        rotationLocks.delete(token);
        log.info('Action finished. Lock released.');
    }

}