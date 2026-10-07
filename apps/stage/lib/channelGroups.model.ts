import { movedKey } from '@stage-labs/client/xmtp/pinOrder';
import { compareNames } from './format';
import { uniqueKeys } from '../components/conversation/SidebarSection.model';

export interface ChannelGroupsPrefs {
  collapsed: string[];
  order: string[];
  orderConfigured?: boolean;
}

export const NO_GROUPS_PREFS: ChannelGroupsPrefs = { collapsed: [], order: [] };

export const CATEGORY_KEY_PREFIX = 'category:';

export function isCategoryKey(key: string): boolean {
  return key.startsWith(CATEGORY_KEY_PREFIX);
}

export function categoryOrderWith(order: readonly string[], visible: readonly string[]): string[] {
  return uniqueKeys([...order, ...visible.toSorted(compareNames)]);
}

const isNamedCategory = (key: string): boolean => isCategoryKey(key) && key.length > CATEGORY_KEY_PREFIX.length;

export function categoryKeysOf(keys: readonly string[]): string[] {
  return uniqueKeys(keys.filter(isNamedCategory));
}

export function movedCategoryOrder(
  order: readonly string[], visible: readonly string[], key: string, targetKey: string,
): string[] {
  const shown = categoryKeysOf(visible);
  const full = categoryOrderWith(order, shown);
  const named = (value: string): string | undefined => (
    shown.some(item => item.toLowerCase() === value.toLowerCase())
      ? full.find(item => item.toLowerCase() === value.toLowerCase()) : undefined
  );
  const moved = named(key);
  const target = named(targetKey);
  return moved === undefined || target === undefined ? [...order] : movedKey(full, moved, target);
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : [];
}

export function parseChannelGroupsPrefs(raw: string): ChannelGroupsPrefs {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return NO_GROUPS_PREFS;
    const { collapsed, order, orderConfigured } = parsed as Partial<Record<keyof ChannelGroupsPrefs, unknown>>;
    return { collapsed: stringsOf(collapsed), order: stringsOf(order), ...(orderConfigured === true ? { orderConfigured } : {}) };
  } catch {
    return NO_GROUPS_PREFS;
  }
}
