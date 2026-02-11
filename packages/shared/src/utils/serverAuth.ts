import path from "node:path";
import { Agent } from "undici";
import fs from 'fs';
import { getConfiguration } from "../config/config.js";


export interface ProgrammaticSSL {
    mainDirPath: string;
    rootCertsPath: string;
    clientCertsPath: string;
    clientKeyPath: string;
}
interface ConnectOptions {
    ca: Buffer | string | (Buffer | string)[];
    cert: Buffer | string | (Buffer | string)[];
    key: Buffer | string | (Buffer | string)[];
}

interface AgentOptions {
    connect?: ConnectOptions;
    connections?: number;
    pipelining?: number;
    keepAliveTimeout?: number;
    keepAliveMaxTimeout?: number;
}

/**
 * Creates an Undici agent configured for authenticated server-to-server calls or bot detection.
 *
 * @param botDetector - When true, returns an agent tuned for bot-detection polling.
 * @param programmaticSSL - Optional SSL configuration for manual overrides.
 * @returns Configured Undici `Agent` instance or `undefined` when not required.
 *
 * @example
 * const agent = getAuthAgent(false);
 */
export function getAuthAgent(botDetector: boolean, programmaticSSL?: ProgrammaticSSL) {
    const { server } = getConfiguration(); 
    const ssl = programmaticSSL || (server.ssl.enableSSL ? server.ssl : undefined);
    const options: AgentOptions = {};

    if (ssl && ssl.mainDirPath && ssl.rootCertsPath && ssl.clientCertsPath && ssl.clientKeyPath) {
        try {
            options.connect = {
                ca: fs.readFileSync(path.join(ssl.mainDirPath, ssl.rootCertsPath)),
                cert: fs.readFileSync(path.join(ssl.mainDirPath, ssl.clientCertsPath)),
                key:  fs.readFileSync(path.join(ssl.mainDirPath, ssl.clientKeyPath)), 
            };
        } catch (err) {
            if (programmaticSSL || server.ssl.enableSSL) throw err;
        }
    }

    if (botDetector) {
        options.connections = 200;          
        options.pipelining = 100;         
        options.keepAliveTimeout = 60_000;   
        options.keepAliveMaxTimeout = 120_000;
    }

    if (Object.keys(options).length > 0) {
        return new Agent(options);
    }
}
