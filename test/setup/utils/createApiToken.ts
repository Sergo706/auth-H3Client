import { defineApiManagementHandler, NewTokens, Privilege } from "auth-h3client/v2";
import { TestUser } from "./createTestUsers.js";
import { parseCookies } from "./parseRawCookies.js";
import { createMockEvent } from "./cookieJar.js";
import { defineHandler } from "h3";
import { CreationSuccess } from "@internal/shared";


export async function createNewApiToken(user: TestUser, body: NewTokens, privilege?: Privilege, allowedToUpdate?: Privilege, ipAddress?: string) {
    const serverCookies = parseCookies(user.serverCookies);
    
    const event = createMockEvent({
                cookies: {
                    "__Secure-a": user.accessToken,
                    "canary_id": user.canary, 
                    "session": serverCookies["session"],
                },
                url: '/new-token',
                params: {
                    action: 'new-token' 
                },
                method: 'POST',
                body,
                ipAddress
        })
    new Promise(res => setTimeout(res, 5000))
    const res = await defineApiManagementHandler(
            defineHandler(async (event) => { 
                const respond = event.context.newApiToken; 
                return respond; 
            }), privilege ?? 'demo', allowedToUpdate ?? 'demo'
    )(event);

    return res as CreationSuccess;

}