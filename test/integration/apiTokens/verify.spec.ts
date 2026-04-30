import { defineAuthenticatePublicApi } from "auth-h3client/v2";
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createUser, TestUser } from "../../setup/utils/createTestUsers.js";
import { createMockEvent } from "../../setup/utils/cookieJar.js";
import { createNewApiToken } from "../../setup/utils/createApiToken.js";
import { defineHandler, H3Event } from "h3";
import { getTokenMetaData } from "../../setup/utils/getTokenMeta.js";
import { CreationSuccess } from "@internal/shared";
import { sleep } from "../../setup/utils/generic.js";
import { fakeLogger } from "../../setup/utils/fakeLogger.js";

let user: TestUser
let anotherUser: TestUser;

let token: CreationSuccess;
let anotherToken: CreationSuccess;


beforeAll(async () => {
    await sleep(5000)
    user =  await createUser('bob1234@gmail.com', 'CorrectPassword123!', 'bob', fakeLogger);
    await sleep(5000)
    anotherUser =  await createUser('bobanother1234@gmail.com', 'CorrectPassword123!', 'another bob', fakeLogger);

    token = await createNewApiToken(user, {name: 'test', prefix: 'prefix'})
    anotherToken = await createNewApiToken(anotherUser, { name: 'anotherTest', prefix: 'testprefix'})
})
afterAll(async () => {
        await sleep(6000);
    });
const verify = async (event: H3Event) => {
     return await defineAuthenticatePublicApi(
                defineHandler(async (event) => { 
                    const respond = event.context.apiVerification
                    return respond; 
                }), 'demo'
        )(event);
};

describe('verification', () => {
    it('successfully verify a valid token', async () => {
        expect(token.rawApiKey).toBeDefined()

        const event = createMockEvent({ apiKey: token.rawApiKey })
        
         const res = await verify(event)

        expect(res).toBeDefined()
        const existingMeta = await getTokenMetaData(user);
        expect(existingMeta).toBeDefined()
        expect(existingMeta.ok).toBe(true)

        if(res && existingMeta.ok) {
            expect(res.providedPrivilege).toBe('demo')
            expect(res.name).toBe('test')
            expect(res.usageCount).toBe(1)
            expect(res.expiresAt).toBeOneOf([null, undefined])
            expect(existingMeta.data.tokenList?.length).toBe(1)
            expect(existingMeta.data.tokenList![0].id).toBe(res.tokenId)
            expect(existingMeta.data.tokenList![0].usage_count).toBe(res.usageCount)
        }

    })
    it('rejects invalid or absent tokens', async () => {
        expect(token.rawApiKey).toBeDefined()


        const event = createMockEvent({ apiKey: undefined })
        
        const res = await verify(event)

        expect(res).toBeDefined()
        // @ts-ignore
        expect(res.ok).toBe(false)
        // @ts-ignore
        expect(res.reason).toBe('No api key provided')
        // @ts-ignore
        expect(res.date).toBeDefined()

         const [a,b,c] = token.rawApiKey!.split("_");
         const malformedToken = `${a}1_${b}_${c}`;

         const event2 = createMockEvent({ apiKey: malformedToken })
         const anotherRes = await verify(event2)
         expect(anotherRes).toBeDefined()
        // @ts-ignore
         expect(anotherRes.ok).toBe(false)
        // @ts-ignore
         expect(anotherRes.reason).toBe('Invalid key')
    })

    it('rate limits on bad requests/inputs', { timeout: 20_000 }, async () => {
         const [a,b,c] = token.rawApiKey!.split("_");
         const malformedToken = `${a}1_${b}_${c}`;
         const event = createMockEvent({ apiKey: malformedToken })
         const results = []

         for (let i = 0; i < 50; i++) {
             const res = await verify(event)
             // @ts-ignore
             if (res.reason === 'To many requests. check "Retry-After" header when to try again.') results.push(res)
                

            await sleep(100)
         }

         expect(results.length).toBeGreaterThan(30)
    })

    it('does not rate limit on successful requests', { timeout: 20_000 }, async () => {
         const event = createMockEvent({ apiKey: anotherToken.rawApiKey })

        for (let i = 0; i < 100; i++) {
             const res = await verify(event)
             // @ts-ignore
            expect(res.providedPrivilege).toBe('demo')
             // @ts-ignore
            expect(res.name).toBe('anotherTest')    
             // @ts-ignore
            expect(res.usageCount).toBe(i + 1)

            await sleep(100)
         }
    })
})