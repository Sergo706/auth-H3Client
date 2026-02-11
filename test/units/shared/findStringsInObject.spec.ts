import { test, describe, expect } from 'vitest';
import { findStringsInObject } from '@internal/shared';

describe('findStringsInObject', () => {
    test('finds string matching key and value criteria', () => {
        const input = {
            user: {
                email: 'test@example.com',
                name: 'Test'
            }
        };
        const result = findStringsInObject(input, new Set(), {
            keyToSearch: 'email',
            value: /@/
        });
        expect(result).toBe('test@example.com');
    });

    test('finds string matching only value criteria', () => {
        const input = {
            data: 'test@example.com'
        };
        const result = findStringsInObject(input, new Set(), {
            keyToSearch: 'email',
            value: /@/
        });
        expect(result).toBe('test@example.com');
    });

    test('recursively searches nested objects', () => {
        const input = {
            a: {
                b: {
                    c: 'match'
                }
            }
        };
        const result = findStringsInObject(input, new Set(), {
            keyToSearch: 'c',
            value: /match/
        });
        expect(result).toBe('match');
        });


    test('stops recursion at max depth', () => {
        const deepObject = { a: { b: { c: { d: { e: 'found' } } } } };

        expect(findStringsInObject(
            deepObject, 
            new Set(), 
            { keyToSearch: 'e', value: /found/ }, 
            0, 
            5
        )).toBeTruthy();
        
        expect(findStringsInObject(
            deepObject, 
            new Set(), 
            { keyToSearch: 'e', value: /found/ }, 
            0, 
            3
        )).toBeNull();
    });

    test('returns null if no match found', () => {
        const input = { a: 'test' };
        const result = findStringsInObject(input, new Set(), {
            keyToSearch: 'b',
            value: /match/
        });
        expect(result).toBeNull();
    });

    test('handles circular references', () => {
        const input: any = { a: 'test' };
        input.self = input;
        
        const result = findStringsInObject(input, new Set(), {
            keyToSearch: 'b',
            value: /nomatch/
        });
        expect(result).toBeNull();
    })
});