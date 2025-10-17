import { sendToServer } from "../utils/serverToServer.js";
import { getLogger } from "../utils/logger.js";
import { notFoundHandler } from "../middleware/notFound.js"
import { defineHandler, getCookie, getQuery, getRequestURL, getRouterParam, H3Event, redirect } from "h3";
import throwError from "../middleware/error.js";


/**
 * Validates temporary links (MFA or password reset) by confirming signed tokens with the auth server
 * and returning structured metadata or falling back to not-found responses.
 *
 * @param event - H3 event for the temporary link verification request.
 * @returns JSON metadata with the link action or redirects/not-found when invalid.
 *
 * @example
 * router.get('/auth/verify-mfa/:visitor', verifyLink);
 */
export default defineHandler(async (event) => {

const { temp } = getQuery(event)
const visitor = getRouterParam(event, "visitor");

const log = 
getLogger().child(
    {
    service: `auth`,
    branch: `tempLinks`,
    reqID: event.context.rid,
    temp: temp, visitor: visitor,
    canary_id: getCookie(event, 'canary_id') 
    });

log.info('Entered Link Verifier')

const cookies = {
    label: 'canary_id',
    value: getCookie(event, 'canary_id')
}

    if (!cookies.value || typeof temp !== "string" || !temp) {
       log.warn('Invalid temp link token. Or canary is possibly undefined')
       return redirect('/auth');
    }
    const url = getRequestURL(event).pathname;
    const getAction    = /^\/auth\/([^/]+)\/[^?]+\?temp=/;
    const action = url.match(getAction)?.[1];
    if (!action) return notFoundHandler(event);

    const serverResponse = await sendToServer(false, `/auth/${action}/${visitor}?temp=${encodeURIComponent(temp)}`,'GET', event, false, cookies)

    if (!serverResponse) {
        throwError(log,event,'SERVER_ERROR', 500, 'Server Error', 'Server error please try again later', 'Api Call Failed')
    };

    const json = await serverResponse.json() as any;
    const linkType = json.link;

    if (serverResponse.ok && event.req.method === 'GET') { 
        log.info(`Link verified with a GET reqs`);
        event.res.status = 200
        event.res.statusText = 'Link verified'
        return {
            action,
            linkType
        }
    }

    if (serverResponse.ok && event.req.method === 'POST') {
        log.info(`Link verified with a POST reqs`)
        return;
    }
    log.info( {Response: serverResponse, Status: serverResponse.status},`link verification failed: invalid link`)
    return notFoundHandler(event);
})
