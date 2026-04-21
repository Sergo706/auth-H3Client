import { askForMfaFlow } from "auth-h3client/v2";
import { createMockEvent } from "../../../../setup/utils/cookieJar.js";
import { inject, expect,it,describe} from "vitest";
import { parseCookies } from "../../../../setup/utils/parseRawCookies.js";
import crypto from 'node:crypto';
import { getLogger } from "auth-h3client/v2";
import { createUser } from "../../../../setup/utils/createTestUsers.js";


describe('Ask for Mfa flow', () => {

   it('Start an mfa flow successfully', async () => {
        const random = crypto.randomBytes(128)
        const log = getLogger().child({service: 'testing'})
        const user = await createUser('sergey@gmail.com', 'CorrectPassword123!', 'Sergio', log);
        const serverCookies = parseCookies(user.serverCookies);

        const event = createMockEvent({
            cookies: {
                "__Secure-a": user.accessToken,
                "canary_id": user.canary, 
                "session": serverCookies["session"],
            }
        })
        await new Promise(r => setTimeout(r, 5000));
        const results = await askForMfaFlow(event, log, crypto.randomUUID(), random) 
        console.log(results)
        expect(results).toHaveProperty('date')
        expect(results.ok).toBe(true)
        if (results.ok) {
            expect(results.data).toBe('Please check your email to complete the action.')
        }
    })

    it('should perform only 1 call for many calls without rate limiting', async () => {
            const random = crypto.randomBytes(128)
            const log = getLogger().child({service: 'testing'})  
            const user = await createUser('jimmy@gmail.com', 'CorrectPassword123!', 'Jimmy', log);
            const serverCookies = parseCookies(user.serverCookies);

            const event = createMockEvent({
                cookies: {
                    "__Secure-a": user.accessToken,
                    "canary_id": user.canary, 
                    "session": serverCookies["session"],
                }
             })
            
            const reason = crypto.randomUUID();
            await new Promise(r => setTimeout(r, 5000));
            const results = await Promise.all(
                 Array.from({ length: 5 }).map(() => 
                    askForMfaFlow(event, log, reason, random, user.accessToken))
            );

            results.forEach(result => {
                expect(result).toHaveProperty('date')
                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.data).toBe('Please check your email to complete the action.')
                }
            })
    })
})