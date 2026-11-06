import { z } from 'zod';
import { movedKey } from '@stage-labs/client/xmtp/pinOrder';
import { storedStrings } from './storeCore';
import { compareNames } from './format';
import { uniqueKeys } from '@stage-labs/client/collections';
import { DM_SECTION, NO_SECTION, isGroupKeyOf, isNamedGroupKey } from './grouping.model';

export interface ChannelGroupsPrefs {
  collapsed: string[];
  order: string[];
  orderConfigured?: boolean;
}

export const NO_GROUPS_PREFS: ChannelGroupsPrefs = { collapsed: [], order: [] };

export function isCategoryKey(key: string): boolean {
  return isGroupKeyOf('category', key);
}

export function categoryOrderWith(order: readonly string[], visible: readonly string[]): string[] {
  return uniqueKeys([...order, ...[...visible].sort(compareNames)]);
}

const isNamedCategory = (key: string): boolean => isNamedGroupKey('category', key);

export function categoryKeysOf(keys: readonly string[]): string[] {
  return uniqueKeys(keys.filter(isNamedCategory));
}

export const isCategorySectionKey = (key: string): boolean => key === DM_SECTION || key === NO_SECTION || isNamedCategory(key);

export function categorySectionKeysOf(keys: readonly string[]): string[] {
  return uniqueKeys(keys.filter(isCategorySectionKey));
}

export function categorySectionOrderWith(order: readonly string[], visible: readonly string[]): string[] {
  const full = categoryOrderWith(order, categoryKeysOf(visible));
  return [...(full.includes(DM_SECTION) ? [] : [DM_SECTION]), ...full, ...(full.includes(NO_SECTION) ? [] : [NO_SECTION])];
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
