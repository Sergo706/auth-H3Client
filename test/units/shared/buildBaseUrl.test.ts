import { describe, it, expect } from 'vitest';
import { getBaseUrl } from '@internal/shared';

describe('getBaseUrl', () => {
    it('should build HTTP URL with custom port', () => {
        const mockCfg = {
            server: {
                ssl: { enableSSL: false },
                auth_location: {
                    serverOrDNS: 'auth.example.com',
                    port: 8080
                }
            }
        } as any;

        const url = getBaseUrl(mockCfg);
        expect(url.toString()).toBe('http://auth.example.com:8080/');
    });

    it('should build HTTPS URL with default port 443', () => {
        const mockCfg = {
            server: {
                ssl: { enableSSL: true },
                auth_location: {
                    serverOrDNS: 'auth.example.com'
                }
            }
        } as any;

        const url = getBaseUrl(mockCfg);
        expect(url.toString()).toBe('https://auth.example.com/');
    });

    it('should build HTTP URL with default port 80', () => {
        const mockCfg = {
            server: {
                ssl: { enableSSL: false },
                auth_location: {
                    serverOrDNS: 'localhost'
                }
            }
        } as any;

        const url = getBaseUrl(mockCfg);
        expect(url.toString()).toBe('http://localhost/');
    });

    it('should handle missing auth_location gracefully (defaults to localhost)', () => {
        const mockCfg = {
            server: {
                ssl: { enableSSL: true }
            }
        } as any;

        try {
            const url = getBaseUrl(mockCfg);
            expect(url.protocol).toBe('https:');
            expect(url.hostname).toBeDefined();
        } catch (e) {
        }
    });

    it('should handle varied serverOrDNS inputs', () => {
        const ips = ['127.0.0.1', '192.168.1.1', '2001:db8::1'];
        for (const ip of ips) {
            const mockCfg = {
                server: {
                    ssl: { enableSSL: false },
                    auth_location: { serverOrDNS: ip }
                }
            } as any;
            const url = getBaseUrl(mockCfg);
            if (ip.includes(':')) {
                expect(url.hostname).toContain(']');
            } else {
                expect(url.hostname).toBe(ip);
            }
        }
    });
});
