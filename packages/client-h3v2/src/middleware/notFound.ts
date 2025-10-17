import { H3Event } from "h3";

/**
 * Sends a standard JSON not-found response for unmatched routes.
 *
 * @param event - H3 event representing the unmatched request.
 * @returns A JSON payload describing the missing resource.
 *
 * @example
 * if (!handled) return notFoundHandler(event);
 */
export function notFoundHandler(event: H3Event) {
    event.res.status = 404
    event.res.statusText = 'Not Found'
    event.res.headers.set('content-type', 'text/plain; charset=utf-8')
    return {error: "The page you are looking for doesn't exists"}
}
