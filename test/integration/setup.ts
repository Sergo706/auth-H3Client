import { beforeAll, afterAll, beforeEach, TestContext } from 'vitest'
import { configuration, getLogger } from 'auth-h3client/v2';
import { config } from '../setup/configs/config.js';
import { cleanupTestDatabase } from '../setup/dbHooks.js';
import { createUser, TestUser } from '../setup/utils/createTestUsers.js';

let testUser: TestUser;
let anotherUser: TestUser;

interface CustomTestContext extends TestContext {
  testUser: TestUser;
  anotherUser: TestUser;
}

beforeAll(async () => {
    configuration(config)
    const log = getLogger().child({service: 'setup'});
    try {

        const user1 = await createUser('sergo998826@gmail.com', 'CorrectPassword123!', 'John', log);
        const user2 = await createUser('f42367195@gmail.com', 'CorrectPassword123!', 'Jane', log);

        testUser = user1;
        anotherUser = user2;

    } catch (err) {
        console.error('Test setup failed:', err);
        throw err;
    }
})

afterAll(async () => {
    await cleanupTestDatabase(testUser.email, testUser.canary)
    await cleanupTestDatabase(anotherUser.email, anotherUser.canary)
})

beforeEach(async (context: CustomTestContext) => {
  context.testUser = testUser;
  context.anotherUser = anotherUser;
});