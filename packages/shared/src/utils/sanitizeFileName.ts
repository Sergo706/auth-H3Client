
/**
 * @description
 * Sanitizes a filename to be safe for use in the filesystem.
 * It removes paths, file extensions, accents, and special characters.
 *
 * @param {string} input - The raw filename or path to sanitize.
 * @param {number} max - The maximum allowed length for the result.
 * @returns {string} The sanitized, filesystem-safe base name.
 *
 * @example
 * sanitizeBaseName('My Cool Photo!.jpg', 20) // 'my-cool-photo'
 * sanitizeBaseName('../../secret/data.pdf', 50) // 'data'
 * sanitizeBaseName('Café', 10) // 'cafe'
 */
export function sanitizeBaseName(input: string, max: number): string {
  const noPath = input.replace(/[/\\]/g, '');
  const dot = noPath.lastIndexOf('.');
  const base = dot > -1 ? noPath.slice(0, dot) : noPath;

  let s = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')        
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')         
    .replace(/-+/g, '-')         
    .replace(/^[-_.]+|[-_.]+$/g, '');  

  if (!s) s = 'file';
  if (s.length > max) s = s.slice(0, max);
  return s;
}