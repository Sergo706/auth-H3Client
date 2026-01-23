import { getLogger } from "@internal/shared";

const rotationLocks = new Map<string, Promise<any>>();

export async function safeAction<T>(token: string, action: () => Promise<T>): Promise<T> {
    const log = getLogger().child({service: 'auth-client', branch: 'utils', type: 'safeAction'});

    if (rotationLocks.has(token)) {
        log.info('Rotation already in progress, waiting for leader...');
        return await rotationLocks.get(token) as T;
    }
    
    const promise = action();
    rotationLocks.set(token, promise);

    try {
        const result = await promise;
        return result;

   } finally {
        rotationLocks.delete(token);
        log.info('Rotation finished. Lock released.');
    }

}