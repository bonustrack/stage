import { useMemo } from 'react';
import { toggleKey } from '../components/conversation/SidebarSection.model';
import {
  NO_GROUPS_PREFS, groupRowsByCategory, parseChannelGroupsPrefs, rowsOf, type ChannelGroupsPrefs, type HomeListItem,
} from '../components/home/groups.model';
import type { Row } from '../components/home/model';
import { makeAccountValue } from './accountValue';
import { reported } from './errorPolicy';
import { useStoreValue } from './storeCore';

const prefs = makeAccountValue<ChannelGroupsPrefs>('channels.groups.', NO_GROUPS_PREFS, parseChannelGroupsPrefs, JSON.stringify);

function primeGroups(): void { void prefs.ready().catch(reported('channelGroups.load')); }

export const useChannelGroups = (): ChannelGroupsPrefs => useStoreValue(prefs.subscribe, prefs.get, primeGroups);

interface GroupedRows {
  grouped: boolean;
  items: HomeListItem[];
  rows: Row[];
}

export function useGroupedRows(visibleRows: Row[], searchText: string): GroupedRows {
  const { grouped, collapsed } = useChannelGroups();
  return useMemo(() => {
    if (!grouped) return { grouped, items: visibleRows, rows: visibleRows };
    const items = groupRowsByCategory(visibleRows, new Set(collapsed), searchText !== '');
    return { grouped, items, rows: rowsOf(items) };
  }, [grouped, collapsed, visibleRows, searchText]);
}

export function toggleGroupByCategory(): void {
  void prefs.update(current => ({ ...current, grouped: !current.grouped })).catch(reported('channelGroups.save'));
}

export function toggleGroupCollapsed(key: string): void {
  void prefs.update(current => ({ ...current, collapsed: toggleKey(current.collapsed, key) })).catch(reported('channelGroups.save'));
}
