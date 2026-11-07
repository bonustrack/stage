export function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function uniqueBy<T>(items: readonly T[], keyOf: (item: T) => string, seen = new Set<string>()): T[] {
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const keyOf = (value: string): string => value.toLowerCase();

export function includesKey(list: readonly string[], value: string): boolean {
  const key = keyOf(value);
  return list.some((item) => keyOf(item) === key);
}

export function uniqueKeys(list: readonly string[]): string[] {
  return uniqueBy(list, keyOf);
}

export function toggleKey(list: readonly string[], value: string, single = false): string[] {
  const key = keyOf(value);
  if (includesKey(list, value)) return list.filter((item) => keyOf(item) !== key);
  return single ? [value] : [...list, value];
}
