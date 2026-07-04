export function compactList<T>(items: (T | undefined | null)[]): T[] {
  return items.filter((item): item is T => item !== undefined && item !== null);
}
