import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { Response } from 'undici';
import { parseResponseContentType } from '@internal/shared';

describe('parseResponseContentType', () => {
    const log = pino({ level: 'silent' });

    it('should parse application/json response with varied cases', async () => {
        const body = { success: true };
        const Res = (globalThis as any).Response || Response;
        
        const r1 = new Res(JSON.stringify(body), { headers: { 'content-type': 'APPLICATION/JSON' } });
        expect(await parseResponseContentType(log, r1)).toEqual(body);

        const r2 = new Res(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
        expect(await parseResponseContentType(log, r2 as any)).toEqual(body);
    });

    it('should parse text/plain and diverse text-like responses', async () => {
        const bodies = ['plain text', '<html></html>', '{"not":"parsed"}'];
        const types = ['text/plain', 'text/html', 'application/xml', 'text/csv'];
        
        for (const body of bodies) {
            for (const type of types) {
                const response = new Response(body, { headers: { 'Content-Type': type } });
                const result = await parseResponseContentType(log, response as any);
                expect(result).toBe(body);
            }
        }
    });

    it('should handle malformed JSON and return undefined', async () => {
        const response = new Response('invalid json', { headers: { 'Content-Type': 'application/json' } });
        const result = await parseResponseContentType(log, response as any);
        expect(result).toBeUndefined();
    });

    it('should handle empty responses', async () => {
        const response = new Response('', { headers: { 'Content-Type': 'application/json' } });
        const result = await parseResponseContentType(log, response as any);
        expect(result).toBeUndefined();
    });
});
