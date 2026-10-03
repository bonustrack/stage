import { toggleKey } from '../components/conversation/SidebarSection.model';
import {
  NO_GROUPS_PREFS, categoryKeysOf, movedCategoryOrder, parseChannelGroupsPrefs, type ChannelGroupsPrefs,
} from './channelGroups.model';
import { reported } from './errorPolicy';
import { loadBoardOrder, type AccountOrderChange } from './boardOrder';
import { createValueStore } from './persistedStore';
import { makeListeners } from './storeCore';

const prefs = createValueStore<ChannelGroupsPrefs>({
  key: 'channels.groups.', default: NO_GROUPS_PREFS, deserialize: parseChannelGroupsPrefs, serialize: JSON.stringify, perAccount: true,
});

export const useChannelGroups = prefs.use;

const categoryOrderChanges = makeListeners<AccountOrderChange>();
export const onCategoryOrderChanged = categoryOrderChanges.subscribe;

function save(next: (current: ChannelGroupsPrefs) => ChannelGroupsPrefs, onlyFor?: string): Promise<void> {
  return prefs.update(next, onlyFor).catch(reported('channelGroups.save'));
}

export function toggleGroupCollapsed(key: string): void {
  void save(current => ({ ...current, collapsed: toggleKey(current.collapsed, key) }));
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, i) => key === b[i]);
}

function withOrder(current: ChannelGroupsPrefs, order: string[]): ChannelGroupsPrefs {
  return sameOrder(current.order, order) ? current : { ...current, order };
}

export function moveCategory(key: string, targetKey: string, visible: readonly string[]): void {
  const accountId = prefs.accountId();
  if (accountId === null) return;
  void save(current => withOrder(current, movedCategoryOrder(current.order, visible, key, targetKey)), accountId)
    .then(() => { if (prefs.accountId() === accountId) categoryOrderChanges.notify({ accountId, order: prefs.get().order }); });
}

export async function applyRemoteCategoryOrder(forAccount: string, order: readonly string[]): Promise<void> {
  await save(current => withOrder(current, [...order]), forAccount);
}

export async function adoptBoardCategoryOrder(forAccount: string): Promise<void> {
  const order = categoryKeysOf(await loadBoardOrder(forAccount));
  if (order.length > 0) await save(current => (current.order.length === 0 ? { ...current, order } : current), forAccount);
}

export async function loadCategoryOrder(forAccount: string): Promise<readonly string[]> {
  await prefs.load();
  return prefs.accountId() === forAccount ? prefs.get().order : [];
}
