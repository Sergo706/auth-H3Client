
/**
 * Recursively searches an object tree for strings matching the provided key and value constraints.
 *
 * @param input - Object to search.
 * @param visited - Internal set preventing circular references.
 * @param searchTerms - Criteria describing keys/values to match.
 * @param depth - Current recursion depth.
 * @param maxDepth - Maximum depth to traverse.
 * @returns Matching string when located; otherwise `null`.
 *
 * @example
 * const email = findStringsInObject(payload, new Set(), { keyToSearch: 'email', value: emailRegex });
 */
export function findStringsInObject(
  input: object,
  visited = new Set<object>(),
  searchTerms: {keyToSearch: string, value: RegExp},
  depth = 0,
  maxDepth = 6
): string | null {
  if (!input || visited.has(input) || depth > maxDepth) return null;

  visited.add(input as object);

  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === "string") {
      if (k.toLowerCase().includes(searchTerms.keyToSearch) && searchTerms.value.test(v.trim())) return v.trim();
      if (searchTerms.value.test(v.trim())) return v.trim();

    } else if (v && typeof v === "object") {
      const found = findStringsInObject(v, visited, searchTerms, depth + 1, maxDepth);
      if (found) return found;
    }
  }
  return null;
}
