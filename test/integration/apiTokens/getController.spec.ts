import { getApiListsController } from "auth-h3client/v2";
import { describe, it, expect, inject, beforeAll } from 'vitest';
import { createMockEvent } from "../../setup/utils/cookieJar.js";
import { parseCookies } from "../../setup/utils/parseRawCookies.js";
import { TokenList } from "@internal/shared";
import { createNewApiToken } from "../../setup/utils/createApiToken.js";
import { createUser, TestUser } from "../../setup/utils/createTestUsers.js";
import { sleep } from "../../setup/utils/generic.js";
import { fakeLogger } from "../../setup/utils/fakeLogger.js";


let user: TestUser
let anotherUser: TestUser;


beforeAll(async () => {
    await sleep(5000)
    user =  await createUser('mosses1234@gmail.com', 'CorrectPassword123!', 'mosses', fakeLogger);
    await sleep(5000)
    anotherUser =  await createUser('mossesanother1234@gmail.com', 'CorrectPassword123!', 'another mosses', fakeLogger);
})

describe('route', () => {
    it('returns expected data', async () => {
        const serverCookies = parseCookies(user.serverCookies);

        const event = createMockEvent({
                    cookies: {
                        "__Secure-a": user.accessToken,
                        "canary_id": user.canary, 
                        "session": serverCookies["session"],
                    }
                })

        const response = await getApiListsController(event);
        expect(response).toBeDefined();
        // @ts-ignore
        expect(response.ok).toBe(true)
        // @ts-ignore
        expect(response.date).toBeTruthy()

        // @ts-ignore
        expect(response.data).toHaveProperty('total', 0)
        // @ts-ignore
        expect(response.data).toHaveProperty('totalInvalidTokens', 0)
        // @ts-ignore
        expect(response.data).toHaveProperty('totalValidTokens', 0)
        // @ts-ignore
        expect(response.data).toHaveProperty('tokenList', undefined)
    })

    it('gets the list of tokens for the authenticated user', async () => {
        await new Promise(resolve =>  setTimeout(resolve, 5000))
        const user = anotherUser
        const serverCookies = parseCookies(user.serverCookies);
        const dataToSend = {
                        name: 'testsisfun',
                        prefix: 'test',
                        ipv4: ["1.2.3.4"],
                        expires: 1000 * 60
                    };

 
        const { rawApiKey, expiresAt} = await createNewApiToken(user, dataToSend, undefined, undefined);

        expect(rawApiKey && expiresAt).toBeTruthy()

        const event = createMockEvent({
                    cookies: {
                        "__Secure-a": user.accessToken,
                        "canary_id": user.canary, 
                        "session": serverCookies["session"],
                    }
                })
        

        const getListResponse = await getApiListsController(event);
        expect(getListResponse).toBeDefined();
        // @ts-ignore
        expect(getListResponse.ok).toBe(true)
        // @ts-ignore
        expect(getListResponse.date).toBeTruthy()

        // @ts-ignore
        expect(getListResponse.data).toHaveProperty('total', 1)
        // @ts-ignore
        expect(getListResponse.data).toHaveProperty('totalInvalidTokens', 0)
        // @ts-ignore
        expect(getListResponse.data).toHaveProperty('totalValidTokens', 1)
        // @ts-ignore
        expect(getListResponse.data).toHaveProperty('tokenList')
        // @ts-ignore
        const tokenList = getListResponse.data.tokenList as TokenList[]

        for (const token of tokenList) {
            expect(token.public_identifier).toBeOneOf([undefined, null])
            expect(token.privilege_type).toBe('demo')
            expect(token.name).toBe('testsisfun')
            expect(token.restricted_to_ip_address).toEqual(["1.2.3.4"])
            expect(token.usage_count).toBe(0)
        }
    })
})