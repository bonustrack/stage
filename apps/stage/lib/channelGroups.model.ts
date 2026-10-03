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

const isNamedCategory = (key: string): boolean => isCategoryKey(key) && key.length > CATEGORY_KEY_PREFIX.length;

export function categoryKeysOf(keys: readonly string[]): string[] {
  return [...new Set(keys.map(key => key.toLowerCase()).filter(isNamedCategory))];
}

export function movedCategoryOrder(
  order: readonly string[], visible: readonly string[], key: string, targetKey: string,
): string[] {
  const shown = categoryKeysOf(visible);
  const [moved, target] = [key.toLowerCase(), targetKey.toLowerCase()];
  if (!shown.includes(moved) || !shown.includes(target)) return [...order];
  return movedKey(categoryOrderWith(order, shown), moved, target);
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
