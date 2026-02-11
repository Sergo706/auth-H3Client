import { describe, it, expect } from 'vitest';
import { findStringsInObject } from '@internal/shared';

describe('findStringsInObject (Rigor)', () => {
    it('should find strings in nested arrays', () => {
        const input = { data: [ { id: 1 }, { secret: 'match_me' } ] };
        const result = findStringsInObject(input, new Set(), { 
            keyToSearch: 'secret', 
            value: /match_me/ 
        });
        expect(result).toBe('match_me');
    });

    it('should find strings in deeply nested arrays and objects', () => {
        const input = { a: [ { b: [ { c: 'target' } ] } ] };
        const result = findStringsInObject(input, new Set(), { 
            keyToSearch: 'c', 
            value: /target/ 
        });
        expect(result).toBe('target');
    });

    it('should respect case-insensitive key matching', () => {
        const input = { MY_KEY: 'found' };
        expect(findStringsInObject(input, new Set(), { keyToSearch: 'my_key', value: /found/ })).toBe('found');
        expect(findStringsInObject(input, new Set(), { keyToSearch: 'KEY', value: /found/ })).toBe('found');
    });

    it('should ignore non-string values during search', () => {
        const input = { key: 123, other: true, more: null, target: 'value' };
        expect(findStringsInObject(input as any, new Set(), { keyToSearch: 'target', value: /value/ })).toBe('value');
    });

    it('should handle large objects efficiently without stack overflow', () => {
        const largeObj: any = {};
        let current = largeObj;
        for (let i = 0; i < 50; i++) {
            current.next = { val: i };
            current = current.next;
        }
        current.target = 'found_deep';
        
        const result = findStringsInObject(largeObj, new Set(), { 
            keyToSearch: 'target', 
            value: /found_deep/ 
        }, 0, 100);
        expect(result).toBe('found_deep');
    });

    it('should gracefully skip unexpected types like Symbols', () => {
        const sym = Symbol('test');
        const input = { [sym]: 'secret', normal: 'safe' };
        const result = findStringsInObject(input as any, new Set(), { 
            keyToSearch: 'secret', 
            value: /any/ 
        });
        expect(result).toBeNull();
    });
});
