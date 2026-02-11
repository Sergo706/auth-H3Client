import { beforeAll } from 'vitest'
import { configuration } from 'auth-h3client/v2';
import { config } from '../setup/configs/config.js';


beforeAll(async () => {
       configuration(config)
})
