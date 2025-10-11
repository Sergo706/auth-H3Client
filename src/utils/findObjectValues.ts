
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
