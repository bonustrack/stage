import { movedPinOrder, pinRank } from '@stage-labs/client/xmtp/pinOrder';

export interface ChannelGroupsPrefs {
  grouped: boolean;
  collapsed: string[];
  order: string[];
}

export const NO_GROUPS_PREFS: ChannelGroupsPrefs = { grouped: false, collapsed: [], order: [] };

export const CATEGORY_KEY_PREFIX = 'category:';

export function isCategoryKey(key: string): boolean {
  return key.startsWith(CATEGORY_KEY_PREFIX);
}

export function compareCategoryKeys(order: readonly string[]): (a: string, b: string) => number {
  const rank = pinRank(order);
  return (a, b) => {
    const ra = rank.get(a);
    const rb = rank.get(b);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined || rb !== undefined) return ra === undefined ? 1 : -1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  };
}

export function categoryOrderWith(order: readonly string[], visible: readonly string[]): string[] {
  const rank = pinRank(order);
  const unranked = visible.filter(key => !rank.has(key)).sort(compareCategoryKeys(order));
  return [...order, ...unranked];
}

export function movedCategoryOrder(
  order: readonly string[], visible: readonly string[], key: string, targetKey: string,
): string[] {
  const full = categoryOrderWith(order, visible);
  return [...movedPinOrder(full, key, full.indexOf(targetKey))];
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : [];
}

export function parseChannelGroupsPrefs(raw: string): ChannelGroupsPrefs {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return NO_GROUPS_PREFS;
    const { grouped, collapsed, order } = parsed as Partial<Record<keyof ChannelGroupsPrefs, unknown>>;
    return { grouped: grouped === true, collapsed: stringsOf(collapsed), order: stringsOf(order) };
  } catch {
    return NO_GROUPS_PREFS;
  }
}
