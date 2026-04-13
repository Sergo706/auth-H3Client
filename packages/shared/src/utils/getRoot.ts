import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Recursively walks up the directory tree until it finds a directory containing
 * the given marker file, then returns that directory's absolute path.
 *
 * @param currentDir - Directory to start the search from. Defaults to the
 *   directory of this module.
 * @param marker - Filename whose presence signals the root (`package.json`).
 * @returns Absolute path of the first directory that contains `marker`.
 * @throws {Error} When the filesystem root is reached without finding `marker`.
 *
 * @example
 * // Find the nearest directory that contains a `tsconfig.json`
 * const root = getRoot('/home/user/project/src', 'tsconfig.json');
 */
export function getRoot(currentDir = __moduleDir, marker = 'package.json'): string {
  if (fs.existsSync(path.join(currentDir, marker))) {
    return currentDir;
  }

  const parentDir = path.resolve(currentDir, '..');
  if (parentDir === currentDir) throw new Error(`Could not find root (marker: "${marker}")`);

  return getRoot(parentDir, marker);
}