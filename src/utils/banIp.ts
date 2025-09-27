import { spawn } from 'child_process';
import { sendLog } from './telegramLogger.js';
import { getLogger } from './logger.js';
const UFW = '/usr/sbin/ufw';

export function banIp(ip: string): Promise<void> {
  const log = getLogger().child({service: 'auth-client', branch: 'utils', type: 'UFW-BANS', ipAddress: ip}) 
  log.info(`About to ban IP ${ip}, On frontend server.`);
  return new Promise((resolve, reject) => {
    const child = spawn('sudo', ['-n', UFW, 'insert', '1', 'deny', 'from', ip], {
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
        log.error(`- CRITICAL - UFW ban failed\n exit code ${code}:\n${stderr.trim()}`)
        sendLog('- CRITICAL - UFW ban failed', `exit ${code}:\n${stderr.trim()}`);
        return reject(new Error(`ufw exited ${code}`));
      }
      log.info(`Banned Detected Bot/Malicious User --- FRONTEND ---`)
      sendLog(
        'Banning Detected Bot/Malicious User --- FRONTEND ---',
        `IP ${ip} banned}`
      );
      resolve();
    });
  });
}
