import { mockEvent, type H3Event } from 'h3';
import { faker } from '@faker-js/faker';

/**
 * Options for creating a mock H3Event.
 */
export interface MockEventOptions {
  /** Custom headers to include in the request */
  headers?: Record<string, string>;
  /** Cookies to be serialized into the Cookie header */
  cookies?: Record<string, string | number>;
  /** HTTP method (default: 'GET') */
  method?: string;
  /** Full URL or path (default: 'http://localhost/') */
  url?: string;
}

/**
 * Creates a mock H3Event (v2) with sensitized headers and simulated client context.
 * Useful for testing utilities like `sendToServer` that rely on H3 event metadata.
 *
 * @param options - Configuration for the mock event.
 * @returns A fully initialized H3Event.
 */
export function createMockEvent(options: MockEventOptions = {}): H3Event {
  const {
    headers = {},
    cookies = {},
    method = 'GET',
    url = 'http://localhost/'
  } = options;

  const parsedUrl = new URL(url.startsWith('/') ? `http://localhost${url}` : url);
  const clientIp: string = '172.29.20.1';

  const cookieString: string = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');

  const defaultHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'X-Forwarded-For': clientIp,
    'X-Real-IP': clientIp,
    'Referer': `${parsedUrl.protocol}//${parsedUrl.host}/`,
    'Origin': `${parsedUrl.protocol}//${parsedUrl.host}`,
    'Host': parsedUrl.host,
    'X-Original-Path': parsedUrl.toString(),
    'X-Forwarded-Host': parsedUrl.host,
    'X-Forwarded-Proto': parsedUrl.protocol.replace(':', ''),
    'X-Client-Tls-Version': 'TLSv1.3',
    'X-Client-Cipher': 'AEAD-AES128-GCM-SHA256',
    'Cookie': cookieString,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Date': new Date().toUTCString(),
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Dest': 'document',
  };

  const normalizedDefaultHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(defaultHeaders)) {
    normalizedDefaultHeaders[key.toLowerCase()] = value;
  }

  const normalizedOptionsHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedOptionsHeaders[key.toLowerCase()] = value;
  }

  return mockEvent(url, {
    method,
    headers: {
      ...normalizedDefaultHeaders,
      ...normalizedOptionsHeaders
    }
  });
}