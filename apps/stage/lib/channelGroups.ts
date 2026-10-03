import { toggleKey } from '../components/conversation/SidebarSection.model';
import { makeAccountValue } from './accountValue';
import { NO_GROUPS_PREFS, movedCategoryOrder, parseChannelGroupsPrefs, type ChannelGroupsPrefs } from './channelGroups.model';
import { reported } from './errorPolicy';
import { notifyCategoryOrderChanged } from './readSyncRegistry';
import { useStoreValue } from './storeCore';

const prefs = makeAccountValue<ChannelGroupsPrefs>('channels.groups.', NO_GROUPS_PREFS, parseChannelGroupsPrefs, JSON.stringify);

function primeGroups(): void { void prefs.ready().catch(reported('channelGroups.load')); }

export const useChannelGroups = (): ChannelGroupsPrefs => useStoreValue(prefs.subscribe, prefs.get, primeGroups);

function save(next: (current: ChannelGroupsPrefs) => ChannelGroupsPrefs, onlyFor?: string): Promise<void> {
  return prefs.update(next, onlyFor).catch(reported('channelGroups.save'));
}

export function toggleGroupByCategory(): void {
  void save(current => ({ ...current, grouped: !current.grouped }));
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
    .then(() => { if (prefs.accountId() === accountId) notifyCategoryOrderChanged({ accountId, order: prefs.get().order }); });
}

export async function applyRemoteCategoryOrder(forAccount: string, order: readonly string[]): Promise<void> {
  await save(current => withOrder(current, [...order]), forAccount);
}

export async function loadCategoryOrder(forAccount: string): Promise<readonly string[]> {
  await prefs.ready();
  return prefs.accountId() === forAccount ? prefs.get().order : [];
}
