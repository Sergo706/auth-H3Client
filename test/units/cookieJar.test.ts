import { describe, test, expect } from 'vitest';
import { createMockEvent } from '../setup/utils/cookieJar.js';

describe('createMockEvent', () => {
  test('generates an event with all required default headers', () => {
    const event = createMockEvent();
    
    expect(event.req.headers.get('user-agent')).toBeDefined();
    expect(event.req.headers.get('x-forwarded-for')).toBeDefined();
    expect(event.req.headers.get('x-real-ip')).toBeDefined();
    expect(event.req.headers.get('host')).toBe('localhost');
    
    expect(event.req.headers.get('referer')).toBe('http://localhost/');
    expect(event.req.headers.get('origin')).toBe('http://localhost');
    expect(event.req.headers.get('x-original-path')).toContain('http://localhost/');
    
    expect(event.req.headers.get('accept')).toContain('application/json');
    expect(event.req.headers.get('accept-language')).toBe('en-US,en;q=0.9');
    
    expect(event.req.headers.get('sec-fetch-user')).toBe('?1');
    expect(event.req.headers.get('sec-fetch-site')).toBe('same-origin');
    expect(event.req.headers.get('sec-fetch-mode')).toBe('navigate');
    expect(event.req.headers.get('sec-fetch-dest')).toBe('document');
  });

  test('derives host and origin from custom URL', () => {
    const event = createMockEvent({
      url: 'https://api.example.com/v1/test'
    });
    
    expect(event.req.headers.get('host')).toBe('api.example.com');
    expect(event.req.headers.get('origin')).toBe('https://api.example.com');
    expect(event.req.headers.get('x-forwarded-proto')).toBe('https');
  });

  test('merges custom headers', () => {
    const event = createMockEvent({
      headers: {
        'X-Custom': 'value',
        'Accept': 'text/html'
      }
    });
    
    expect(event.req.headers.get('x-custom')).toBe('value');
    expect(event.req.headers.get('accept')).toBe('text/html');
  });

  test('serializes cookies correctly', () => {
    const event = createMockEvent({
      cookies: {
        session: '123',
        theme: 'dark'
      }
    });
    
    const cookie = event.req.headers.get('cookie');
    expect(cookie).toContain('session=123');
    expect(cookie).toContain('theme=dark');
  });
});
