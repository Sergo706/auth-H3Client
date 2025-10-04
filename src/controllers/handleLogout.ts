import { assertMethod, deleteCookie, getCookie, getQuery, getRequestIP, H3Event } from "h3";
import { getLogger } from "../utils/logger.js";
import { sendToServer } from "../utils/serverToServer.js";
import throwError from "../middleware/error.js";
import { getConfiguration } from "../config/config.js";


export async function handleLogout(event: H3Event) {
    assertMethod(event, "POST")
    const body = event.context.body;
    const { domain } = getConfiguration();

    const log = getLogger().child({service: 'auth', branch: 'classic', type: 'logout', ip: getRequestIP(event)});
    const canary = getCookie(event, 'canary_id');
    const token = getCookie(event, '__Secure-a');
    const contentType = event.req.headers.get('Content-Type');

    if (Object.keys(getQuery(event)).length !== 0) {
        throwError(log,event,'FORBIDDEN', 400,'Bad Request','','Query string not allowed')
    }

    if (contentType) {
        throwError(log,event,'FORBIDDEN', 415,'Body not allowed','','Content-Type not allowed')
    }

     if (body) {
        throwError(log,event,'FORBIDDEN', 400,'Body not allowed','','Body in logout is not allowed.')
    }

    const session = getCookie(event, 'session');
    
    if (!session || !canary || !token) {
        throwError(log,event,'INVALID_CREDENTIALS',401,'No credentials','No credentials','User is already logged out session cookies are missing.')
    }
    
    const cookies = [{
        label: 'session',
        value: session
    }]

    try {
        const response = await sendToServer(false, '/auth/logout', 'POST', event,false,cookies,{},token)
        const msg = await response?.json() as {ok: boolean, message?: string, error?: string}

        if (!response || !response.ok) {
            throwError(log,event,'SERVER_ERROR', 500, 'Server Error', 'Server error please try again later', `Api Call Failed. \n
                    server response: \n
                    code: ${response?.status} \n
                    msg: ${msg}
                `)
        };

        log.info(`Got logout results, validating...`);  

        if (response.status !== 200) {
            throwError(log,event,'AUTH_SERVER_ERROR', response.status, 'Logout error', 'Server error please try again later', `${msg.error}`)
        };

        deleteCookie(event, '__Secure-a', { 
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'strict',
            domain 
        });
        deleteCookie(event, 'a-iat', { path: '/', domain });
        deleteCookie(event, 'session', { path: '/', domain });
        deleteCookie(event, 'iat', { path: '/', domain });
        log.info(`User logged out successfully`);

        return {
            success: true,
            msg: msg.message
        };

    }  catch(err) {
        log.error({err}, `Couldn't log user out. server error`);
        throwError(log,event,'SERVER_ERROR', 500, 'Logout error', 'Server error please try again later');
    } 

}