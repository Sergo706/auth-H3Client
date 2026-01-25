import { sendToServer } from '../utils/serverToServer.js';
import { getLogger } from "@internal/shared";
import { banIp } from "@internal/shared";
import { appendHeader, assertMethod, getCookie, getHeader, getQuery, getRequestIP, getRouterParam, setResponseStatus } from 'h3';
import throwError from '../middleware/error.js';
import { defineDeduplicatedEventHandler } from '../utils/requestDedupHandler.js';

/**
 * Submits a new password for visitors who passed link validation, enforcing payload rules
 * and translating auth server responses into user-facing results.
 *
 * @param event - H3 event for the password reset completion request.
 * @returns JSON payload confirming the reset or detailing validation issues.
 *
 * @example
 * router.post('/auth/reset-password/:visitor', sendNewPassword, { middleware: [...] });
 */
export default defineDeduplicatedEventHandler(async (event) => {

assertMethod(event, "POST")
const visitor = getRouterParam(event, "visitor");
const { temp } = getQuery(event)

const log = 
getLogger().child({service: `auth`, branch: 'password-reset', reqID: event.context.rid, temp: temp, visitor: visitor, 
canary_id: getCookie(event, 'canary_id') });

    const cookies = {
    label: 'canary_id',
    value: getCookie(event, 'canary_id')
}

log.info(`Entered sendNewPassword Post Route`)

const contentType = getHeader(event, 'Content-Type')!;

if (!contentType || contentType !== 'application/json') {
  throwError(log, event, 'INVALID_CONTENT_TYPE', 400, 'Invalid Content-Type', 'Content-Type must be application/json', `Received: ${contentType}`);
};

if (!cookies.value || typeof temp !== "string" || !temp) {
        throwError(log,event,'INVALID_CREDENTIALS',403,'FORBIDDEN', 'INVALID_CREDENTIALS', 'Invalid temp link token. Or canary is possibly undefined')
}


const body = event.context.body as { password: string | undefined; confirmedPassword: string | undefined}

if (!body) {
    throwError(log,event,'MISSING_BODY',400, 'Invalid request body.', 'This field is required.', 'Invalid request body.')
}

const { password, confirmedPassword } = body;

log.info(`Validating password...`);

if (!password) {
        throwError(log,event,'MISSING_BODY',400, 'Invalid request body.', 'This field is required.', 
            'One or more fields are empty. or content type is not json.');
    }

    if (password !== confirmedPassword) {
        log.warn(`Provided passwords does not match`)
        throwError(log,event,'INVALID_CREDENTIALS', 400, "Passwords don't match", 'Provided passwords does not match','Provided passwords does not match')
    }

    log.warn(`Sending new password to server...`)

    try {
      const sendData = await 
      sendToServer(false, `/auth/reset-password/${visitor}?temp=${encodeURIComponent(temp)}`, 'POST', event, true, cookies, { password, confirmedPassword });

        if (!sendData) {
        throwError(log,event,'SERVER_ERROR', 500, 'Server Error', 'Server error please try again later', 'Api Call Failed')
        }

        log.info(`Got results, validating...`);  
        const json = await sendData.json() as any;

    if (sendData.status === 400) {
        throwError(log,event,'AUTH_SERVER_ERROR', 400, 'Error changing password', 'Error changing password', `error changing password ${json.error}`)
    }

    if (sendData.status === 403) {
        banIp(getRequestIP(event)!)  
        throwError(log,event,'FORBIDDEN', 403, 'FORBIDDEN', 'Not allowed this time, please try again later.', 
            `User has been banned / blacklisted`);
    }

        if (sendData.status === 429) {
        const retrySec = sendData.headers.get('Retry-After');
         log.warn(`User rate limited`);  

        if (retrySec) {
            appendHeader(event, 'Retry-After', (retrySec as unknown as number))
            setResponseStatus(event, 429)
            return {error: `To many attempts, please try again later.`};
        } 
        
        setResponseStatus(event, 429)
        return { error: `To many attempts, please try again later.`};
    };

    if (sendData.status === 200 && json.success) {
        log.info(`User changed is password`);  
        setResponseStatus(event, 200)
        return {ans: `Your password has been reset! Please login to your account to continue.`}
     };

    } catch(err) {
      throwError(log,event,'SERVER_ERROR',500,`Unexpected error`,`An error occurred please try again later.`,`Unexpected error ${err}`)  
 }
})
