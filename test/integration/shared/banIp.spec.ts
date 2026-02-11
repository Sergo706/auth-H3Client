import { banIp } from 'auth-h3client/v2'
import { describe, it, expect } from 'vitest'

describe.skip('banIp integration tests', () => {
    /**
     * These tests interact with the system's firewall (ufw) via sudo.
     * They will attempt to modify real rules. We use documentation/test IPs
     * to minimize impact, but the environment must have appropriate permissions.
     * run sudo visudo and paste: 
     * `sergio ALL=(root) NOPASSWD: /usr/sbin/ufw insert 1 deny from *, /usr/sbin/ufw deny from *` and remove the skip param from the suite to run these tests. 
     */

    it('should successfully execute ufw command for a valid IPv4 address', async () => {
        const testIp: string = '203.0.113.100';
        await expect(banIp(testIp)).resolves.toBeUndefined();
    });

    it('should successfully execute ufw command for a valid IPv6 address', async () => {
        const testIp: string = '2001:db8::1';
        await expect(banIp(testIp)).resolves.toBeUndefined();
    });

    it('should fail when provided with an invalid IP address format', async () => {
        const invalidIp: string = 'not-an-ip-address';
        await expect(banIp(invalidIp)).rejects.toThrow();
    });

    it('should fail when provided with an out-of-range IP address', async () => {
        const invalidIp: string = '999.999.999.999';
        await expect(banIp(invalidIp)).rejects.toThrow();
    });

    it('should handle empty string input by failing', async () => {
        await expect(banIp('')).rejects.toThrow();
    });
});