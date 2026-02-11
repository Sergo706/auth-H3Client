import { spawn } from 'child_process';
import { sendLog } from './telegramLogger.js';
import { getLogger } from './logger.js';
const UFW = '/usr/sbin/ufw';

/**
 * Executes a UFW rule to block the provided IP address and reports the outcome via logging.
 *
 * @param ip - The IPv4 or IPv6 address to block.
 * @returns Promise resolved when the rule is inserted.
 *
 * @example
 * await banIp('203.0.113.42');
 */
export function banIp(ip: string): Promise<void> {
  const log = getLogger().child({service: 'auth-client', branch: 'utils', type: 'UFW-BANS', ipAddress: ip}) 
  log.info(`About to ban IP ${ip}, On frontend server.`);

  const executeUfw = (args: string[]): Promise<void> => {
    return new Promise((resolve, reject) => {
      const child = spawn('sudo', ['-n', UFW, ...args], {
        stdio: ['ignore', 'ignore', 'pipe'],
        detached: true  
      });

      child.unref();  

      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        log.error(`ufw hang timeout`)
        reject(new Error(`ufw hang timeout`));
      }, 5_000);

      child.stderr.on('data', d => (stderr += d.toString()));
      
      child.on('error', err => {
        clearTimeout(timer);
        log.error({msg: err.message},`- CRITICAL - UFW spawn failed`)
        sendLog('- CRITICAL - UFW spawn failed', err.message);
        reject(err);
      });

      child.on('close', code => {
        clearTimeout(timer);
        if (code !== 0) {
          const errorMsg = `ufw exited ${code}: ${stderr.trim()}`;
          return reject(new Error(errorMsg));
        }
        resolve();
      });
    });
  };

  return executeUfw(['insert', '1', 'deny', 'from', ip])
    .catch(async (err: Error) => {
      if (err.message.includes("Invalid position '1'")) {
        log.info(`UFW insert failed (empty list), falling back to standard deny for ${ip}`);
        return executeUfw(['deny', 'from', ip]);
      }
      throw err;
    })
    .then(() => {
      log.info(`Banned Detected Bot/Malicious User --- FRONTEND ---`)
      sendLog(
        'Banning Detected Bot/Malicious User --- FRONTEND ---',
        `IP ${ip} banned}`
      );
    })
    .catch((err: Error) => {
      log.error(`- CRITICAL - UFW ban failed\n ${err.message}`)
      sendLog('- CRITICAL - UFW ban failed', err.message);
      throw err;
    });
}
