import { sendToServer } from '../utils/serverToServer.js';
import { getLogger } from "@internal/shared";
import { banIp } from "@internal/shared";
import { assertMethod, getRequestIP, HTTPError } from 'h3';
import throwError from '../middleware/error.js';
import { defineDeduplicatedEventHandler } from '../utils/requestDedupHandler.js';




/**
 * Initiates a password reset by validating the email payload and forwarding the
 * request to the auth server, translating responses into rate limit or success messages.
 *
 * @param event - H3 event representing the password-reset initiation request.
 * @returns JSON payload indicating whether the email was dispatched.
 *
 * @example
 * router.post('/auth/password-reset', initPasswordReset, { middleware: [...] });
 */
export default defineDeduplicatedEventHandler(async (event) => {

  const log = getLogger().child({service: 'auth', branch: 'password-reset'})
  assertMethod(event, "POST")


log.info(`started password reset process, sending email to server...`);

const contentType = event.req.headers.get('Content-Type')!;

if (!contentType || contentType !== 'application/json') {
  throwError(log, event, 'INVALID_CONTENT_TYPE', 400, 'Invalid Content-Type', 'Content-Type must be application/json', `Received: ${contentType}`);
};

const body = event.context.body as {email: string | undefined};

  if (!body) {
      throwError(log,event,'MISSING_BODY',400, 'Invalid request body.', 'This field is required.', 'Invalid request body.')
  }

const { email } = body;

if (!email) {
    throwError(log,event,'MISSING_BODY',400, 'MISSING_BODY', 'This field is required.', 'One or more fields are empty. or content type is not json.')
}

    try {
        const sendData = await sendToServer(false, '/auth/forgot-password', 'POST', event, true, undefined, { email });

        if (!sendData) {
            throwError(log,event,'SERVER_ERROR', 500, 'Server Error', 'Server error please try again later', 'Api Call Failed')
        }

        log.info(`Got results, validating...`);  

    if (sendData.status === 400) {
        throwError(log,event,'INVALID_CREDENTIALS', 400,'Invalid email', 'Invalid email', 'Invalid email entered')
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
            event.res.headers.append('Retry-After', retrySec)
            event.res.status = 429
            return {error: `To many attempts, please try again later.`};
        } 

            event.res.status = 429
            return {error: `To many attempts, please try again later.`};
    };

        if (sendData.status === 200 || sendData.status === 201) {
        log.info(`Reset email was send successfully.`); 
        event.res.status = 200 
        return {
            ans: `A link to restart your password was sent to your email!`
        } 
    };

    } catch(err) {
        if (err instanceof HTTPError) {
        throw err;
    }
     throwError(log,event,'SERVER_ERROR',500,`Unexpected error`,`An error occurred please try again later.`,`Unexpected error ${err}`)  
}

})
