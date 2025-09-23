import { H3Event } from "h3";

export function notFoundHandler(event: H3Event) {
    event.res.status = 404
    event.res.statusText = 'Not Found'
    event.res.headers.set('content-type', 'text/plain; charset=utf-8')
    return "The page you are looking for doesn't exists"
}