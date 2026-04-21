import { askForMfaFlow } from "auth-h3client/v2";
import { createMockEvent } from "../../../../setup/utils/cookieJar.js";
import { inject, expect,it,describe, beforeAll } from "vitest";
import { parseCookies } from "../../../../setup/utils/parseRawCookies.js";
import crypto from 'node:crypto';
import { getLogger } from "auth-h3client/v2";
import { createUser } from "../../../../setup/utils/createTestUsers.js";

    
describe('should reject on bad data inputs', () => {
    
    it('throws on missing tokens', async () => {
            const random = crypto.randomBytes(128)
            const log = getLogger().child({service: 'testing'})  
            const user = inject('testUser')
            const serverCookies = parseCookies(user.serverCookies);

            const eventWithoutAccess = createMockEvent({
            cookies: {
                "canary_id": user.canary, 
                "session": serverCookies["session"],
            }
        })

            const noAccessToken = await askForMfaFlow(eventWithoutAccess, log, crypto.randomUUID(), random)
            expect(noAccessToken).toHaveProperty('date')
            expect(noAccessToken.ok).toBe(false) 
            expect(noAccessToken.code).toBe('INVALID_CREDENTIALS')
            if (!noAccessToken.ok) {
                expect(noAccessToken.reason).toBe('Server error please try again later')
            }
        })

        it('should throw on invalid access or refresh tokens', async () => {
            const random = crypto.randomBytes(128)
            const log = getLogger().child({service: 'testing'})  
            const user = inject('testUser')
            const serverCookies = parseCookies(user.serverCookies);


            const event = createMockEvent({
                 cookies: {
                    "__Secure-a": crypto.randomUUID(),
                    "canary_id": user.canary, 
                    "session": serverCookies["session"],
                 }
            })
            const results = await askForMfaFlow(event, log, crypto.randomUUID(), random)
            expect(results).toHaveProperty('date')
            expect(results.ok).toBe(false) 
            expect(results.code).toBe('INVALID_CREDENTIALS')
            if (!results.ok) {
                expect(results.reason).toBe('Invalid email or password')
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
            const eventWithRandomSession = createMockEvent({
                 cookies: {
                    "__Secure-a": user.accessToken,
                    "canary_id": user.canary, 
                    "session": crypto.randomUUID(),
                 }
            })
            const randomSessionResults = await askForMfaFlow(eventWithRandomSession, log, crypto.randomUUID(), random)
            expect(randomSessionResults).toHaveProperty('date')
            expect(randomSessionResults.ok).toBe(false) 
            expect(randomSessionResults.code).toBe('INVALID_CREDENTIALS')
            if (!randomSessionResults.ok) {
                expect(randomSessionResults.reason).toBe('Invalid email or password')
            }
        })

        it('should trigger a standard build in mfa on weird behavior', async () => {
            const random = crypto.randomBytes(128)
            const log = getLogger().child({service: 'testing'})  
            const user = inject('testUser')
            const anotherUser = inject('anotherUser')
            const serverCookies = parseCookies(user.serverCookies);
            const anotherServerCookies = parseCookies(anotherUser.serverCookies);



            const event = createMockEvent({
                 cookies: {
                    "__Secure-a": user.accessToken,
                    "canary_id": anotherUser.canary, 
                    "session": serverCookies["session"],
                 }
            })
            await new Promise(resolve => setTimeout(resolve, 5000));
            const resultsForMixedCanary = await askForMfaFlow(event, log, crypto.randomUUID(), random)
            expect(resultsForMixedCanary).toHaveProperty('date')
            expect(resultsForMixedCanary.ok).toBe(false) 
            expect(resultsForMixedCanary.code).toBe('MFA_REQUIRED')
            if (!resultsForMixedCanary.ok) {
                expect(resultsForMixedCanary.reason).toBeOneOf(['A login link has been sent to your email.', "Please verify your session first. check your email."])
            }



            const replayEvent = createMockEvent({
                 cookies: {
                    "__Secure-a": user.accessToken,
                    "canary_id": user.canary, 
                    "session": anotherServerCookies["session"],
                 }
            })
            await new Promise(resolve => setTimeout(resolve, 5000));

            const resultsForReplay = await askForMfaFlow(replayEvent, log, crypto.randomUUID(), random)
            expect(resultsForReplay).toHaveProperty('date')
            expect(resultsForReplay.ok).toBe(false) 
            expect(resultsForReplay.code).toBe('MFA_REQUIRED')
            if (!resultsForReplay.ok) {
                expect(resultsForReplay.reason).toBeOneOf(['A login link has been sent to your email.', "Please verify your session first. check your email."])
            }

        })
        it('should allow direct access token passing', async () => {
            const random = crypto.randomBytes(128)
            const log = getLogger().child({service: 'testing'})  
            const user = await createUser('sergeyriavzon@gmail.com', 'CorrectPassword123!', 'Sergey', log);
            const serverCookies = parseCookies(user.serverCookies);

            const event = createMockEvent({
            cookies: {
                "canary_id": user.canary, 
                "session": serverCookies["session"],
            }
        })
            await new Promise(r => setTimeout(r, 5000))

            const results = await askForMfaFlow(event, log, crypto.randomUUID(), random, user.accessToken)
            expect(results).toHaveProperty('date')
            expect(results.ok).toBe(true)
            if (results.ok) {
                expect(results.data).toBe('Please check your email to complete the action.')
            }
        })
        
    })

        describe('enforce reason and random rules', () => {
            it('should throw on to short or long random value', async () => {
                const shortRandom = crypto.randomBytes(5)
                const log = getLogger().child({service: 'testing'})  
                const user = inject('testUser')
                const serverCookies = parseCookies(user.serverCookies);
    
                const event = createMockEvent({
                cookies: {
                    "__Secure-a": user.accessToken,
                    "canary_id": user.canary, 
                    "session": serverCookies["session"],
                }
                 })
    
                const toShort = await askForMfaFlow(event, log, crypto.randomUUID(), shortRandom, user.accessToken)
                expect(toShort).toHaveProperty('date')
                expect(toShort.ok).toBe(false)
                expect(toShort.code).toBe("HASH")
                if (!toShort.ok) {
                    expect(toShort.reason).toBe('Hash to short or long.')
                }
    
                const longRandom = crypto.randomBytes(500)
                const toLong = await askForMfaFlow(event, log, crypto.randomUUID(), longRandom, user.accessToken)
                expect(toLong).toHaveProperty('date')
                expect(toLong.ok).toBe(false)
                expect(toLong.code).toBe("HASH")
                if (!toLong.ok) {
                    expect(toLong.reason).toBe('Hash to short or long.')
                }
    
            })
    
            it('should throw if random is raw string', async () => {
                const random = 'string'.repeat(50);
                const log = getLogger().child({service: 'testing'})  
                const user = inject('testUser')
                const serverCookies = parseCookies(user.serverCookies);
    
                const event = createMockEvent({
                cookies: {
                    "__Secure-a": user.accessToken,
                    "canary_id": user.canary, 
                    "session": serverCookies["session"],
                }
                 })
                 // @ts-ignore
                const results = await askForMfaFlow(event, log, crypto.randomUUID(), random, user.accessToken)
                expect(results).toHaveProperty('date')
                expect(results.ok).toBe(false)
                expect(results.code).toBe("HASH")
                if (!results.ok) {
                    expect(results.reason).toBe('Random is not a buffer.')
                }
            })
    
            it('should throw if reason is to long', async () => {
                const random = crypto.randomBytes(128)
                const log = getLogger().child({service: 'testing'})  
                const user = inject('testUser')
                const serverCookies = parseCookies(user.serverCookies);
                const reason = 'reason'.repeat(100)
                const event = createMockEvent({
                    cookies: {
                        "__Secure-a": user.accessToken,
                        "canary_id": user.canary, 
                        "session": serverCookies["session"],
                    }
                 })
    
                const results = await askForMfaFlow(event, log, reason, random, user.accessToken)
                expect(results).toHaveProperty('date')
                expect(results.ok).toBe(false)
                expect(results.code).toBe("REASON")
                if (!results.ok) {
                    expect(results.reason).toBe('Reason is to long')
                }
            })
        })
    