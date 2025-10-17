import { H3Event, setHeader, setResponseStatus } from "h3";

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
    setResponseStatus(event, 404, 'Not Found')
    setHeader(event, 'content-type', 'text/plain; charset=utf-8')
    return {error: "The page you are looking for doesn't exists"}
}
