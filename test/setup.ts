import { beforeAll, afterAll, afterEach, beforeEach, TestContext } from 'vitest'
import { configuration, getLogger } from 'auth-h3client/v2';
import child from 'node:child_process'
import { config } from './setup/configs/config.js';
import { DB_CONFIG } from './setup/dbHooks.js';
import { createUser, TestUser } from './setup/utils/createTestUsers.js';
import mysql2 from 'mysql2/promise';
import util from 'node:util';
import { createTablesForTesting } from './setup/setupTestDB.js';
import { parseResponseContentType, serviceToService } from "auth-h3client/v2";
import { createMockEvent } from "./setup/utils/cookieJar.js";

const exec = util.promisify(child.exec);

const run = async (command: string) => {
    try {
        const { stdout, stderr } = await exec(command);
        console.log('stdout:', stdout);
        if (stderr) console.error('stderr:', stderr);
    } catch (error) {
        console.error(`exec error: ${error}`);
        throw error;
    }
}

let testUser: TestUser;
let anotherUser: TestUser;

async function waitForDatabase() {
  const maxRetries = 30;
  const retryInterval = 3000;
  
  for (let i = 0; i < maxRetries; i++) {
      try {
          const connection = await mysql2.createConnection(DB_CONFIG);
          await connection.end();
          return;
        } catch (err) {
            console.log(`Waiting for database... (attempt ${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }
    throw new Error('Database failed to start in time');
}
async function waitForAuth() {
    const maxRetries = 30;
    const event = createMockEvent({
              url: '/login'
    });
      console.log(`Waiting for auth...`);
      const retryInterval = 3000;
      for (let i = 0; i < maxRetries; i++) {
          try {
            const response = await serviceToService(
                false, 
                `/login`, 
                'POST', 
                event, 
                true, 
                undefined, 
                { email: 'sergo998826@gmail.com', password: 'CorrectPassword123!' }
            );
            if (response) {
                console.log(`Auth login Status code: ${response.status}`);
                return;
            }
          } catch (err) {
            console.log(`Waiting for auth... (attempt ${i + 1}/${maxRetries})`);
          }
          await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
      throw new Error('Auth service failed to become ready in time');
}
interface CustomTestContext extends TestContext {
  testUser: TestUser;
  anotherUser: TestUser;
}



beforeAll(async () => {
    configuration(config)
    const log = getLogger().child({service: 'setup'});
    try {
        await run('docker compose -f docker-compose.test.yml up -d mysql-test')
        await waitForDatabase();
        await createTablesForTesting();
        
        await run('docker compose -f docker-compose.test.yml up -d auth-test')
        await waitForAuth()

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
    await run('docker compose -f docker-compose.test.yml down -v')
    await run ('docker network prune -f')
})

beforeEach(async (context: CustomTestContext) => {
  context.testUser = testUser;
  context.anotherUser = anotherUser;
});

afterEach(async () => {
  const connection = await mysql2.createConnection(DB_CONFIG);
  await connection.execute('DELETE FROM refresh_tokens WHERE 1=1');
});