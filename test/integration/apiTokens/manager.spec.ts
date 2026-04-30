import { defineApiManagementHandler, defineAuthenticatePublicApi } from "auth-h3client/v2";
import { describe, it, expect, beforeAll, inject } from 'vitest';
import { createUser, TestUser } from "../../setup/utils/createTestUsers.js";
import { createMockEvent } from "../../setup/utils/cookieJar.js";
import { createNewApiToken } from "../../setup/utils/createApiToken.js";
import { defineHandler } from "h3";
import { getTokenMetaData } from "../../setup/utils/getTokenMeta.js";
import { CreationSuccess } from "@internal/shared";
import { parseCookies } from "../../setup/utils/parseRawCookies.js";
import { sleep } from "../../setup/utils/generic.js";
import { fakeLogger } from "../../setup/utils/fakeLogger.js";


let user: TestUser
let anotherUser: TestUser;

let token: CreationSuccess;
let anotherToken: CreationSuccess;

beforeAll(async () => {
    await sleep(5000)
    user =  await createUser('charley1234@gmail.com', 'CorrectPassword123!', 'charley', fakeLogger);
    await sleep(5000)
    anotherUser =  await createUser('charleyanother1234@gmail.com', 'CorrectPassword123!', 'another charley', fakeLogger);

    token = await createNewApiToken(user, {name: 'test', prefix: 'prefix'}, undefined, undefined)
    anotherToken = await createNewApiToken(anotherUser, { name: 'anotherTest', prefix: 'testprefix', expires: 1000 * 60 * 60 }, 'restricted', 'full', )
})

const verify = async (token: string) => {

    const event = createMockEvent({ apiKey: token })
     return await defineAuthenticatePublicApi(
                defineHandler(async (event) => { 
                    const respond = event.context.apiVerification
                    return respond; 
                }), 'demo'
        )(event);
};

const createAuthenticatedPostEvent = (body: Record<string, unknown>, endPoint: string) => {
      const serverCookies = parseCookies(user.serverCookies);

      const event = createMockEvent({
                cookies: {
                    "__Secure-a": user.accessToken,
                    "canary_id": user.canary, 
                    "session": serverCookies["session"],
                },
                url: `/${endPoint}`,
                params: {
                    action: `${endPoint}` 
                },
                method: 'POST',
                body
        });
        return event;
}

describe('authenticated api management', () => {

  it('creates a token for an authenticated user', () => {
        expect(token.rawApiKey).toBeDefined()
        expect(token.expiresAt).toBeOneOf([undefined, null])
        // @ts-ignore
        expect(token.rawPublicId).toBeOneOf([undefined, null])
        expect(anotherToken.expiresAt).toBeTruthy()
  })

  it('updates the ip list successfully', async () => {
        const verifyRes = await verify(token.rawApiKey!)
        expect(verifyRes).toBeDefined();

        const body = {
            ipv4: ["1.1.1.1"],
            tokenId: verifyRes?.tokenId
        }

        const event = createAuthenticatedPostEvent(body, 'ip-restriction-update')
        const res = await defineApiManagementHandler(
                    defineHandler(async (event) => { 
                        const respond = event.context.ipRestrictionUpdate; 
                        return respond; 
                    }), 'demo', 'demo'
            )(event);

        expect(res!.msg).toBe('Restriction updated successfully');
        await new Promise(res => setTimeout(res, 3000))
        const meta = await getTokenMetaData(user);
        expect(meta.ok).toBe(true)

        if (meta.ok) {
            const tokenMeta = meta.data.tokenList!.find(a => a.id === verifyRes!.tokenId)
            expect(tokenMeta?.restricted_to_ip_address).toEqual(["1.1.1.1"])
        }
  })
})