import { configuration, getLogger } from 'auth-h3client/v2';
import { config } from './setup/configs/config.js';
import { DB_CONFIG } from './setup/dbHooks.js';
import mysql2 from 'mysql2/promise';
import { serviceToService } from "auth-h3client/v2";
import { createMockEvent } from "./setup/utils/cookieJar.js";
import { run } from './setup/utils/run.js'
import { createUser, TestUser } from './setup/utils/createTestUsers.js';
import type { TestProject } from 'vitest/node'
import { getCanaryCookie } from './setup/utils/getCanaryCookie.js';

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

      const canary = await getCanaryCookie(event)
      const cookies = [
                {
                    label: `canary_id`,
                    value: canary
                }
         ];

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
                cookies, 
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


export async function setup(project: TestProject) {
    configuration(config)
    
    try {
        await run ('rm -rf auth-logs')
        await run('docker compose -f docker-compose.test.yml up -d mysql-test')
        await waitForDatabase();
        
        await run('docker compose -f docker-compose.test.yml up -d auth-test')
        await waitForAuth()
        const log = getLogger().child({service: 'setup'});

        testUser = await createUser('sergo998826@gmail.com', 'CorrectPassword123!', 'John', log);
        await new Promise(resolve => setTimeout(resolve, 5000));
        anotherUser = await createUser('f42367195@gmail.com', 'CorrectPassword123!', 'Jane', log);
        project.provide('testUser', testUser)
        project.provide('anotherUser', anotherUser)
        
    } catch (err) {
        console.error('Test setup failed:', err);
        throw err;
    }
}

export async function teardown() {
    await run('docker compose -f docker-compose.test.yml down -v')
    await run ('docker network prune -f')
}
