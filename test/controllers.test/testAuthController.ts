import { getLogger } from '../../src/utils/logger.js'
import { getConfiguration } from "../../src/config/config.js"
import { defineHandler, getCookie } from "h3"
import {sendToServer} from "../../src/utils/serverToServer.js"

export default defineHandler(async (event) => {
const {server} = getConfiguration()
const log = getLogger().child({service: 'auth', type: 'dataAccess'});

    const token = event.context.accessToken;

    const cookies = [{
        label: 'session',
        value: getCookie(event, 'session')
    },
 {
        label: 'canary_id',
        value: getCookie(event, 'canary_id')
 }
]

    const response = await sendToServer(false, '/secret/data', 'GET', event, false, cookies)
    
    if (!response) return;

    const json: any = await response.json();
    console.log(response.status,`\n`, json);

    if (response.status === 401) {
        event.res.status = response.status
        return {error: json.error}
    }

    if (response.status === 202) {
         log.info({code: response.status, ServerResponse: json},'2MFA is required')
         event.res.status = 202
         return { error: '2MFA is required' }
    } 
    
    // Add also for 202
    // Add rotation for canary id, it triggers mfa every time it expired.
    // RBAC
    // DB Adapters
    // OAuth Deep intergration
    event.res.status = 200
    return {
        Authorized: true,
        when: new Date().toISOString(),
        content: '<h1> Yay! your got an account! </h1>'
    }

    return;
})
