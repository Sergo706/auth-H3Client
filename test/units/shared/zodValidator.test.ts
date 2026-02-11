import { describe, it, expect } from 'vitest';
import { validateZodSchema, getLogger } from '@internal/shared';
import { z } from 'zod';

describe('validateZodSchema (Rigor)', () => {
    const complexSchema = z.object({
        user: z.object({
            id: z.uuid(),
            age: z.number().int().min(18)
        }),
        tags: z.array(z.string().min(1)).max(5),
        meta: z.record(z.string(), z.string()).optional()
    });

    it('should return data on successful complex validation', () => {
        const log = getLogger().child({ component: 'test-validator' });
        const data = { 
            user: { id: '550e8400-e29b-41d4-a716-446655440000', age: 25 },
            tags: ['dev', 'rigor'],
            meta: { platform: 'linux' }
        };
        const result = validateZodSchema(complexSchema, data, log);
        
        if ('data' in result) {
            expect(result.data).toEqual(data);
        } else {
            throw new Error('Expected success result');
        }
    });

    it('should return structured errors using TOP-LEVEL keys only (Current Implementation)', () => {
        const log = getLogger().child({ component: 'test-validator' });
        const invalidData = { 
            user: { id: 'bad-uuid', age: 10 },
            tags: ['ok', '', 'too many', 'tags', 'added', 'here']
        };
        const result = validateZodSchema(complexSchema, invalidData, log);
        
        if ('valid' in result && result.valid === false) {
            expect(result.errors['user Error']).toBeDefined();
            expect(result.errors['tags Error']).toBeDefined();
        } else {
            throw new Error('Expected validation error');
        }
    });

    it('should handle Zod transformations and refinements', () => {
        const refinedSchema = z.object({
            num: z.string().transform(v => parseInt(v)).refine(n => n % 2 === 0, {
                message: "Must be even"
            })
        });
        const log = getLogger().child({ component: 'test-validator' });
        
        const r1 = validateZodSchema(refinedSchema, { num: '4' }, log);
        if ('data' in r1) {
            expect(r1.data.num).toBe(4);
        }

        const r2 = validateZodSchema(refinedSchema, { num: '3' }, log);
        if ('valid' in r2 && r2.valid === false) {
            expect(r2.errors['num Error']).toContain('Must be even');
        }
    });
});
