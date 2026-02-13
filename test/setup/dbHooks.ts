import fs from "node:fs";
import mysql2 from 'mysql2/promise';

export const DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: 3308,
  user: 'sergio',
  password: 'very_secure_password_for_tests',
  database: 'my_auth_tests_db',
  multipleStatements: true,
  flags: ['+LOCAL_FILES'],
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
  infileStreamFactory: (path: string) => fs.createReadStream(path)
};


export async function createTestUser(email: string = 'test@example.com'): Promise<number> {
  const connection = await mysql2.createConnection(DB_CONFIG);
  
  try {
    const [existingUsers] = await connection.execute<mysql2.RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return existingUsers[0].id;
    }

    const canaryId = `test-canary-${Date.now()}-${Math.random()}`;
    const [visitorResult] = await connection.execute<mysql2.ResultSetHeader>(
      'INSERT INTO visitors (canary_id, ip_address, user_agent) VALUES (?, ?, ?)',
      [canaryId, '127.0.0.1', 'test-user-agent']
    );

    const visitorId = visitorResult.insertId;

    const [userResult] = await connection.execute<mysql2.ResultSetHeader>(
      'INSERT INTO users (name, last_name, email, password_hash, visitor_id) VALUES (?, ?, ?, ?, ?)',
      ['John', 'Doe', email, 'test-password-hash', visitorId]
    );

    return userResult.insertId;
  } finally {
  }
  
}

export async function cleanupTestDatabase(email: string, canary: string): Promise<void> {
    const connection = await mysql2.createConnection(DB_CONFIG);
  
  try {
    await connection.execute(`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE "%${email}%")`);
    await connection.execute(`DELETE FROM mfa_codes WHERE user_id IN (SELECT id FROM users WHERE email LIKE "%${email}%")`);
    await connection.execute(`DELETE FROM users WHERE email LIKE "%${email}%"`);
    await connection.execute(`DELETE FROM visitors WHERE canary_id LIKE "${canary}"`);
  } catch (error) {
    console.warn('Cleanup warning:', error);
  }
}