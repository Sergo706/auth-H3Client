import path from "path";
import { Agent } from "undici";
import fs from 'fs';
import { getConfiguration } from "../config/config.js";


export function getAuthAgent(botDetector: boolean) {
    const { server } = getConfiguration(); 
    if (server.ssl.enableSSL && !botDetector) {
        const KEY_DIR   = server.ssl.mainDirPath;
        const cert    = fs.readFileSync(path.join(KEY_DIR, server.ssl.rootCertsPath));
        const clientCert= fs.readFileSync(path.join(KEY_DIR, server.ssl.clientCertsPath));
        const clientKey = fs.readFileSync(path.join(KEY_DIR, server.ssl.clientKeyPath));
        return new Agent ({
            connect: {
                ca: cert,
                cert: clientCert,
                key:  clientKey, 
            }
        })
    }
    if  (botDetector) {
        return new Agent ({
              connections: 200,          
              pipelining: 100,         
              keepAliveTimeout: 60_000,   
              keepAliveMaxTimeout: 120_000,
        })
    }
}
