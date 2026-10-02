export function uniqueBy<T>(items: readonly T[], keyOf: (item: T) => string, seen = new Set<string>()): T[] {
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
