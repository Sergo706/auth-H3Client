import { configuration } from 'auth-h3client/v2';
import { config } from './setup/configs/config.js';
import { DB_CONFIG } from './setup/dbHooks.js';
import mysql2 from 'mysql2/promise';
import { createTablesForTesting } from './setup/setupTestDB.js';
import { serviceToService } from "auth-h3client/v2";
import { createMockEvent } from "./setup/utils/cookieJar.js";
import { run } from './setup/utils/run.js'

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


export async function setup() {
    configuration(config)
    
    try {
        await run('docker compose -f docker-compose.test.yml up -d mysql-test')
        await waitForDatabase();
        await createTablesForTesting();
        
        await run('docker compose -f docker-compose.test.yml up -d auth-test')
        await waitForAuth()

    } catch (err) {
        console.error('Test setup failed:', err);
        throw err;
    }
}

export async function teardown() {
    await run('docker compose -f docker-compose.test.yml down -v')
    await run ('docker network prune -f')
}
