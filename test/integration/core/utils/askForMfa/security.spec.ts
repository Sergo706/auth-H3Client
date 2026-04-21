import { askForMfaFlow } from "auth-h3client/v2";
import { createMockEvent } from "../../../../setup/utils/cookieJar.js";
import { inject, expect,it,describe} from "vitest";
import { parseCookies } from "../../../../setup/utils/parseRawCookies.js";
import crypto from 'node:crypto';
import { getLogger } from "auth-h3client/v2";
import { createUser } from "../../../../setup/utils/createTestUsers.js";



describe('Security', () => {
        it('should trigger rate limiting', async () => {
            const random = crypto.randomBytes(128)
            const log = getLogger().child({service: 'testing'})  
            const user = await createUser('alice@gmail.com', 'CorrectPassword123!', 'Alice', log);
            const serverCookies = parseCookies(user.serverCookies);

            const event = createMockEvent({
                cookies: {
                    "__Secure-a": user.accessToken,
                    "canary_id": user.canary, 
                    "session": serverCookies["session"],
                }
             })
            
            await new Promise(r => setTimeout(r, 1000));
            const results = await Promise.all(
                Array.from({ length: 11 }).map(() => 
                    askForMfaFlow(event, log, crypto.randomUUID(), random, user.accessToken)
                )
            );

            const rateLimited = results.filter(r => !r.ok && r.code === "RATE_LIMIT");
            const successful = results.filter(r => r.ok);

            expect(rateLimited.length).toBeGreaterThan(0);
            rateLimited.forEach(result => {
                expect(result).toHaveProperty('date')
                expect(result.ok).toBe(false)
                expect(result.code).toBe("RATE_LIMIT")
                if (!result.ok) {
                    expect(result.reason).toBe('Too many attempts, please try again later.')
                    expect(result).toHaveProperty('retryAfter')
                }
            })

            console.info({ 
                total: results.length, 
                successful: successful.length, 
                rateLimited: rateLimited.length 
            }, "Rate limit test summary");
    })
})