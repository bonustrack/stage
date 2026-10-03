import { movedKey } from '@stage-labs/client/xmtp/pinOrder';
import { compareNames } from './format';

export interface ChannelGroupsPrefs {
  collapsed: string[];
  order: string[];
}

export const NO_GROUPS_PREFS: ChannelGroupsPrefs = { collapsed: [], order: [] };

export const CATEGORY_KEY_PREFIX = 'category:';

export function isCategoryKey(key: string): boolean {
  return key.startsWith(CATEGORY_KEY_PREFIX);
}

export function categoryOrderWith(order: readonly string[], visible: readonly string[]): string[] {
  return [...order, ...visible.filter(key => !order.includes(key)).sort(compareNames)];
}

export function movedCategoryOrder(
  order: readonly string[], visible: readonly string[], key: string, targetKey: string,
): string[] {
  return movedKey(categoryOrderWith(order, visible), key, targetKey);
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : [];
}

export function parseChannelGroupsPrefs(raw: string): ChannelGroupsPrefs {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return NO_GROUPS_PREFS;
    const { collapsed, order } = parsed as Partial<Record<keyof ChannelGroupsPrefs, unknown>>;
    return { collapsed: stringsOf(collapsed), order: stringsOf(order) };
  } catch {
    return NO_GROUPS_PREFS;
  }
}
