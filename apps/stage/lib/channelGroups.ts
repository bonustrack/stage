import { toggleKey } from '@stage-labs/client/collections';
import {
  NO_GROUPS_PREFS,
  categoryKeysOf,
  categorySectionKeysOf,
  movedCategoryOrder,
  channelGroupsSchema,
  type ChannelGroupsPrefs,
} from './channelGroups.model';
import { reported } from './errorPolicy';
import { loadBoardOrder } from './boardOrder';
import { createValueStore, type StoreSource } from './persistedStore';
import { settingChanges, type SyncedSetting } from './sync/setting';

const prefs = createValueStore<ChannelGroupsPrefs>({
  key: 'channels.groups.',
  default: NO_GROUPS_PREFS,
  schema: channelGroupsSchema,
  perAccount: true,
});

export const channelGroupsSource: StoreSource<ChannelGroupsPrefs> = prefs;

const categoryOrderChanges = settingChanges<readonly string[]>();

function save(next: (current: ChannelGroupsPrefs) => ChannelGroupsPrefs, onlyFor?: string): Promise<void> {
  return prefs.update(next, onlyFor).catch(reported('channelGroups.save'));
}

export function toggleGroupCollapsed(key: string): void {
  void save((current) => ({ ...current, collapsed: toggleKey(current.collapsed, key) }));
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, i) => key === b[i]);
}

function withOrder(current: ChannelGroupsPrefs, order: string[]): ChannelGroupsPrefs {
  return current.orderConfigured && sameOrder(current.order, order) ? current : { ...current, order, orderConfigured: true };
}

function changeCategoryOrder(next: (order: string[]) => string[]): void {
  const accountId = prefs.accountId();
  if (accountId === null) return;
  void save((current) => withOrder(current, next(current.order)), accountId).then(() => {
    if (prefs.accountId() === accountId) categoryOrderChanges.notify({ accountId, state: prefs.get().order });
  });
}

export function setCategoryOrder(order: readonly string[]): void {
  changeCategoryOrder(() => categorySectionKeysOf(order));
}

export function moveCategory(key: string, targetKey: string, visible: readonly string[]): void {
  changeCategoryOrder((order) => movedCategoryOrder(order, visible, key, targetKey));
}

export async function adoptBoardCategoryOrder(forAccount: string): Promise<void> {
  const order = categoryKeysOf(await loadBoardOrder(forAccount));
  if (order.length > 0)
    await save((current) => (current.order.length === 0 && !current.orderConfigured ? withOrder(current, order) : current), forAccount);
}

async function loadCategoryOrder(forAccount: string): Promise<readonly string[]> {
  await prefs.load();
  return prefs.accountId() === forAccount ? prefs.get().order : [];
}

export const categoryOrderSync: SyncedSetting<readonly string[]> = {
  onLocalChange: categoryOrderChanges.subscribe,
  load: loadCategoryOrder,
  applyRemote: (forAccount, order) => save((current) => withOrder(current, [...order]), forAccount),
};
