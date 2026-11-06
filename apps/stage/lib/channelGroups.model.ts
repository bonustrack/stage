import { z } from 'zod';
import { movedKey } from '@stage-labs/client/xmtp/pinOrder';
import { storedStrings } from './storeCore';
import { compareNames } from './format';
import { uniqueKeys } from '@stage-labs/client/collections';

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
  return uniqueKeys([...order, ...[...visible].sort(compareNames)]);
}

const isNamedCategory = (key: string): boolean => isCategoryKey(key) && key.length > CATEGORY_KEY_PREFIX.length;

export function categoryKeysOf(keys: readonly string[]): string[] {
  return uniqueKeys(keys.filter(isNamedCategory));
}

export const isCategorySectionKey = (key: string): boolean => key === 'dm' || key === 'none' || isNamedCategory(key);

export function categorySectionKeysOf(keys: readonly string[]): string[] {
  return uniqueKeys(keys.filter(isCategorySectionKey));
}

export function categorySectionOrderWith(order: readonly string[], visible: readonly string[]): string[] {
  const full = categoryOrderWith(order, categoryKeysOf(visible));
  return [...(full.includes('dm') ? [] : ['dm']), ...full, ...(full.includes('none') ? [] : ['none'])];
}

export function movedCategoryOrder(order: readonly string[], visible: readonly string[], key: string, targetKey: string): string[] {
  const shown = categorySectionKeysOf(visible);
  const full = categorySectionOrderWith(order, shown);
  const named = (value: string): string | undefined =>
    shown.some((item) => item.toLowerCase() === value.toLowerCase())
      ? full.find((item) => item.toLowerCase() === value.toLowerCase())
      : undefined;
  const moved = named(key);
  const target = named(targetKey);
  return moved === undefined || target === undefined ? [...order] : movedKey(full, moved, target);
}

export const channelGroupsSchema = z.object({
  collapsed: storedStrings.catch([]),
  order: storedStrings.catch([]),
  orderConfigured: z.literal(true).optional().catch(undefined),
});
