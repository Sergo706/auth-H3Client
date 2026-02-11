import { getAuthAgent } from "@internal/shared";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Agent } from "undici";
import { run } from "../../setup/utils/run.js";
import path from "node:path";
import fs from "node:fs";

const TEST_KEY_DIR = path.join(process.cwd(), 'test-certs-tmp');

/**
 * mkcert should be installed locally to run these tests successfully
 */
describe('Auth Agent', () => {

    beforeAll(async () => {
        if (!fs.existsSync(TEST_KEY_DIR)) {
            fs.mkdirSync(TEST_KEY_DIR, { recursive: true });
        }
        const certPath = path.join(TEST_KEY_DIR, 'cert.pem');
        const keyPath = path.join(TEST_KEY_DIR, 'key.pem');
        
        await run(`mkcert -client -cert-file ${certPath} -key-file ${keyPath} localhost 127.0.0.1`);
        fs.copyFileSync(certPath, path.join(TEST_KEY_DIR, 'root.pem'));
    });

    afterAll(async () => {
        if (fs.existsSync(TEST_KEY_DIR)) {
            await run(`rm -rf ${TEST_KEY_DIR}`);
        }
    });
    
    it('Should return a performance optimized undici agent when botDetector is true', () => {
        const agent = getAuthAgent(true);
        expect(agent).toBeInstanceOf(Agent);

        const kOptions = Object.getOwnPropertySymbols(agent).find(s => s.description === 'options');
        const options = kOptions ? (agent as any)[kOptions] : undefined;
        
        expect(options).toBeDefined();
        expect(options.connections).toBe(200);
        expect(options.pipelining).toBe(100);
        expect(options.keepAliveTimeout).toBe(60_000);
    });

    it('Should return undefined when botDetector is false', () => {
        const agent = getAuthAgent(false);
        expect(agent).toBeUndefined();
    });

    it('Should return an mTLS undici agent when programmaticSSL is provided', () => {

        const agent = getAuthAgent(false, {
            mainDirPath: TEST_KEY_DIR,
            rootCertsPath: 'root.pem',
            clientCertsPath: 'cert.pem',
            clientKeyPath: 'key.pem'
        });

        expect(agent).toBeInstanceOf(Agent);
        
        const kOptions = Object.getOwnPropertySymbols(agent).find(s => s.description === 'options');
        const options = (agent as any)[kOptions!];
        

        expect(options.connect.ca).toBeDefined();
        expect(options.connect.cert).toBeDefined();
        expect(options.connect.key).toBeDefined();
    });

    it('Should return an agent with BOTH SSL and performance options', () => {

        const agent = getAuthAgent(true, {
            mainDirPath: TEST_KEY_DIR,
            rootCertsPath: 'root.pem',
            clientCertsPath: 'cert.pem',
            clientKeyPath: 'key.pem'
        });

        expect(agent).toBeInstanceOf(Agent);
        
        const kOptions = Object.getOwnPropertySymbols(agent!).find(s => s.description === 'options');
        const options = (agent as any)[kOptions!];
        
        expect(options.connections).toBe(200);
        expect(options.pipelining).toBe(100);
        expect(options.keepAliveTimeout).toBe(60_000);
        expect(options.connect.ca).toBeDefined();
        expect(options.connect.cert).toBeDefined();
        expect(options.connect.key).toBeDefined();
    });
});
