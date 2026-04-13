import fs from "node:fs";

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