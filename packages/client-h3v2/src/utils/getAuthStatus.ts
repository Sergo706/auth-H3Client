import { defineAuthenticatedEventHandler } from "./defineAuthRoute.js";
import throwHttpError from "../middleware/error.js";
import { getLogger } from "@internal/shared";

/**
 * Authenticated status endpoint handler.
 * Returns the current user's auth data if authenticated.
 * 
 * @example
 * // In a Nuxt server route:
 * import { getAuthStatusHandler } from 'auth-h3client';
 * export default getAuthStatusHandler;
 */
export const getAuthStatusHandler = defineAuthenticatedEventHandler(
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
            ...user
        };
    }
);

export default getAuthStatusHandler;