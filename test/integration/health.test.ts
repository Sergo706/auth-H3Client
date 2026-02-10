import { describe, it, expect } from 'vitest';
import mysql2 from 'mysql2/promise';
import { DB_CONFIG } from '../setup/dbHooks.js';

describe('Environment Health Check', () => {
    
    it('should connect to the test database', async () => {
        const connection = await mysql2.createConnection(DB_CONFIG);
        try {
            const [rows] = await connection.execute('SELECT 1 as val');
            // @ts-ignore
            expect(rows[0].val).toBe(1);
        } finally {
            await connection.end();
        }
    });

    it('should have seeded test users from global setup', async (context) => {
        const { testUser, anotherUser } = context as any;

        expect(testUser).toBeDefined();
        expect(anotherUser).toBeDefined();
        console.log(`Verifying users: ${testUser.email}, ${anotherUser.email}`);

        const connection = await mysql2.createConnection(DB_CONFIG);
        try {
            const [users] = await connection.execute<mysql2.RowDataPacket[]>('SELECT * FROM users WHERE email IN (?, ?)', [testUser.email, anotherUser.email]);
            expect(users.length).toBe(2);
        } finally {
            await connection.end();
        }
    });
});
