import { serviceToService } from "auth-h3client/v2";
import { createMockEvent } from "./cookieJar.js";
import { parseResponseContentType } from "auth-h3client/v2";
import pino from "pino";
import { ResponseSign } from "@internal/shared";
import { getCanaryCookie } from "./getCanaryCookie.js";


export interface TestUser {
    name: string,
    password: string,
    email: string,
    serverCookies: string[],
    accessToken: string,
    canary: string,
    accessIat: string
}
export async function createUser(email: string, password: string, name: string, log: pino.Logger): Promise<TestUser> {
    try {
        const event = createMockEvent({
            url: '/signup'
         });

         const canary = await getCanaryCookie(event)
         if (!canary) {
            throw new Error(`Getting canary cookie!`)
         }
         const cookies = [
                {
                    label: `canary_id`,
                    value: canary
                }
         ]
         const data = {
            name,
            email,
            password,
            confirmedPassword: password,
            rememberUser: "on",
            termsConsent: "on"
         }
        const res = await serviceToService(false, `/signup`, "POST", event, true, cookies, data) 

        if (!res) {
            throw new Error("Error creating new user")
        }
        const json = await parseResponseContentType(log, res) as ResponseSign
        const rawJson = JSON.stringify(json)
        if (!json.ok) {
            throw new Error(`Error creating new user ${JSON.stringify(rawJson)}`)
        }
        const cookiesFromServer = res.headers.getSetCookie();
        const accessToken = json.accessToken;
        const accessIat = json.accessIat;

        console.log(`User ${name} created successfully`)
        return {
            name,
            password,
            email,
            serverCookies: cookiesFromServer,
            accessToken,
            canary,
            accessIat
        }
    } catch(err) {
        throw err;
    }
}