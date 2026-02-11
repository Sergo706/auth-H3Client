import { test, describe, expect } from 'vitest';
import { MiniCache } from '@internal/shared';

describe('MiniCache', () => {
    test('sets and gets values', () => {
        const cache = new MiniCache();
        cache.set('key', 'value', 1000);
        expect(cache.get('key')).toBe('value');
    });

    test('returns null for missing keys', () => {
        const cache = new MiniCache();
        expect(cache.get('missing')).toBeNull();
    });

    test('expires values', async () => {
        const cache = new MiniCache();
        cache.set('key', 'value', 10);
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(cache.get('key')).toBeNull();
    });

    test('evicts oldest when maxEntries reached', () => {
        const cache = new MiniCache(2);
        cache.set('a', 1, 1000);
        cache.set('b', 2, 1000);
        cache.set('c', 3, 1000);

        expect(cache.get('a')).toBeNull();
        expect(cache.get('b')).toBe(2);
        expect(cache.get('c')).toBe(3);
    });

    test('updates LRU position on access', () => {
        const cache = new MiniCache(2);
        cache.set('a', 1, 1000);
        cache.set('b', 2, 1000);
        cache.get('a'); // 'a' becomes most recently used
        cache.set('c', 3, 1000); // Should evict 'b'

        expect(cache.get('b')).toBeNull();
        expect(cache.get('a')).toBe(1);
    });

    test('clears cache', () => {
        const cache = new MiniCache();
        cache.set('a', 1, 1000);
        cache.clear();
        expect(cache.get('a')).toBeNull();
    });
});