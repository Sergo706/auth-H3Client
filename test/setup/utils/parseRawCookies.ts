export function parseCookies(cookies: Record<string, unknown> | string[] | string): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  const ATTRIBUTES = new Set([
    'path',
    'domain',
    'expires',
    'max-age',
    'samesite',
    'secure',
    'httponly',
    'partitioned',
    'priority'
  ]);

  const parsePair = (pair: string) => {
    const [name, val] = pair.split('=');
    if (name) {
      const trimmedName = name.trim();
      if (trimmedName && !ATTRIBUTES.has(trimmedName.toLowerCase())) {
        result[trimmedName] = decodeURIComponent(val?.trim() || '');
      }
    }
  };

  if (Array.isArray(cookies)) {
    cookies.forEach((cookie) => {
      const [main] = cookie.split(';');
      parsePair(main);
    });
  } else if (typeof cookies === 'string') {
    cookies.split(';').forEach(parsePair);
  } else if (typeof cookies === 'object' && cookies !== null) {
    for (const [key, value] of Object.entries(cookies)) {
      if (typeof value === 'string' || typeof value === 'number') {
        result[key] = value;
      } else {
        result[key] = String(value);
      }
    }
  }

  return result;
}
