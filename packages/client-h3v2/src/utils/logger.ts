import pino, { Logger } from 'pino';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfiguration } from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.resolve(__dirname, '..', '..', 'logs');
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

const transport = pino.transport({
  targets: [
    {
      target: 'pino/file',
      level:  'info',
      options: {
        destination: `${LOG_DIR}/info.log`,
        mkdir: true
      }
    },
    {
      target: 'pino/file',
      level:  'warn',
      options: {
        destination: `${LOG_DIR}/warn.log`,
        mkdir: true
      }
    },
    {
      target: 'pino/file',
      level:  'error',
      options: {
        destination: `${LOG_DIR}/errors.log`,
        mkdir:true
      }
    }
  ]
});
let logger: pino.Logger;  

/**
 * @description
 * Get the logger of the client and log custom events you need.  
 * 3 files will be created under node_modules/@riavzon/auth-H3Client, in a structured json lines.
 * 
 * info.log contains info waring, error, and fatal level logs.
 * 
 * warn contains waring, error, and fatal level logs
 * 
 * error.log contains error, and fatal level logs
 *
 *
 * @returns {logger}
 * Configured pino.Logger
 *
 * @example
 * const log = getLogger().child({service: 'auth', branch: 'logout'});
 * log.info('loggin user out...')
 * @see {@link https://github.com/pinojs/pino}
 */

export function getLogger(): Logger {
  if (logger) return logger;      
  const { logLevel } = getConfiguration();
  logger = (pino) (
    {
    level: logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin() { return { uptime: process.uptime() }; },
    redact: {
      paths: [
        'req.headers.authorization',
      '*.password',
       '*.email',
        'name',
        'Name',
        '*.cookies',
        '*.cookie',
        'cookies',
        'cookie',
        '*.accessToken',
        '*.refresh_token',
        '*.secret'
      ],
      censor: '[SECRET]'
     }
    },
  transport
  )
  return logger;
}