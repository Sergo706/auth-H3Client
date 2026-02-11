import { parseResponseContentType, serviceToService } from "auth-h3client/v2";
import { describe, it, expect } from "vitest";
import { createMockEvent } from "../setup/utils/cookieJar.js";
import { getLogger } from "auth-h3client/v2";
describe('Service Communication', () => {
    it('Can reach the service', async ({ testUser }) => {
        const log = getLogger().child({service: 'tests'})

        const event = createMockEvent({
            url: '/login'
        });

        expect(testUser.email).toBe('sergo998826@gmail.com');
        expect(event.req.headers.get('host')).toBe('localhost');
        
        const response = await serviceToService(
            false, 
            `/login`, 
            'POST', 
            event, 
            true, 
            undefined, 
            { email: testUser.email, password: testUser.password }
        );
        
        expect(response).toBeDefined();
        if (response) {
             expect(response.status).toBeDefined();
        }
    });
});