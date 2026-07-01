import type {
  ListViewItemNode,
  ListViewNode,
} from '@stage-labs/kit/kit';

export function compact<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value === undefined || value === null) continue;
    out[key] = value;
  }
  return out as T;
}

export function compactList<T>(items: (T | undefined | null)[]): T[] {
  return items.filter((item): item is T => item !== undefined && item !== null);
}

export function listRoot(item: ListViewItemNode): ListViewNode {
  return { type: 'ListView', children: [item] };
}
