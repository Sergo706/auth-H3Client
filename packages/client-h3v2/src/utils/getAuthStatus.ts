import { defineAuthenticatedEventHandler } from "./defineAuthRoute.js";
import { getLogger, throwHttpError } from "../main.js";

/**
 * Creates an authenticated status endpoint handler.
 * Returns the current user's auth data if authenticated.
 * 
 * @param storage - The storage instance for caching auth data
 * @returns Event handler that returns user auth status
 * 
 * @example
 * // In your Nuxt server route:
 * import { getAuthStatusHandler } from '@internal/client-h3v2';
 * export default getAuthStatusHandler(useStorage('cache'));
 */
export const getAuthStatusHandler = () => {
    return defineAuthenticatedEventHandler(
        (event) => {
            const log = getLogger().child({ service: 'auth-client-status', branch: 'status', type: 'handler' });
            const user = event.context.authorizedData;
            
            log.info({ userId: user?.userId }, 'Auth status check');
            
            if (!user) {
                throwHttpError(log, event, 'AUTH_REQUIRED', 401, 'UnAuthorized', 'Un Authorized action', 
                    'Un Authorized action detected.');
            }

            const id = Number(user.userId);
            if (!id) {
                throwHttpError(log, event, 'AUTH_CLIENT_ERROR', 400, 'Bad request', '', 
                    'Failed to get userId.');
            }

            return {
                authenticated: true,
                userId: id,
                roles: user.roles,
                ...user
            };
        },
    );
};