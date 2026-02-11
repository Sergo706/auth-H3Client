import child from 'node:child_process'
import util from 'node:util';

const exec = util.promisify(child.exec);

export const run = async (command: string) => {
    try {
        const { stdout, stderr } = await exec(command);
        console.log('stdout:', stdout);
        if (stderr) console.error('stderr:', stderr);
    } catch (error) {
        console.error(`exec error: ${error}`);
        throw error;
    }
}