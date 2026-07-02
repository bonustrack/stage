
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { type ChannelRow as Row } from './channelsSummarize';
import { markConvRead, markConvUnread } from './channelsCache';
import { toggleArchived } from './archived';
import { deriveBarLabels, filterChannelRows } from '@stage-labs/client/xmtp/channelsFilter';

export interface RowMenu { convId: string; title: string; isUnread: boolean; x: number; y: number }

export interface ChannelRowMenu {
  rowMenu: Ref<RowMenu | null>;
  openRowMenu: (r: Row, ev: MouseEvent) => void;
  closeRowMenu: () => void;
  toggleRowUnread: () => void;
  archiveRow: () => void;
}

export function useChannelRowMenu(archivedTick: Ref<number>): ChannelRowMenu {
  const rowMenu = ref<RowMenu | null>(null);
  function openRowMenu(r: Row, ev: MouseEvent): void {
    const maxX = (typeof window !== 'undefined' ? window.innerWidth : 9999) - 200;
    rowMenu.value = {
      convId: r.convId,
      title: r.title,
      isUnread: r.unreadCount > 0 || r.markedUnread,
      x: Math.max(8, Math.min(ev.clientX, maxX)),
      y: ev.clientY,
    };
  }
  function closeRowMenu(): void { rowMenu.value = null; }
  function toggleRowUnread(): void {
    const m = rowMenu.value;
    if (!m) return;
    closeRowMenu();
    if (m.isUnread) markConvRead(m.convId);
    else markConvUnread(m.convId);
  }
  function archiveRow(): void {
    const m = rowMenu.value;
    if (!m) return;
    closeRowMenu();
    toggleArchived(m.convId);
    archivedTick.value += 1;
  }
  return { rowMenu, openRowMenu, closeRowMenu, toggleRowUnread, archiveRow };
}

export interface ChannelFilters {
  barLabels: ComputedRef<string[]>;
  enabledLabels: Ref<Set<string>>;
  unreadOnly: Ref<boolean>;
  toggleLabel: (label: string) => void;
  toggleUnread: () => void;
  clearAllFilters: () => void;
  labelFilteredRows: ComputedRef<Row[] | null>;
}

export function useChannelFilters(visibleRows: ComputedRef<Row[] | null>): ChannelFilters {
  const enabledLabels = ref<Set<string>>(new Set());
  const unreadOnly = ref(false);

  function toggleLabel(label: string): void {
    const next = new Set(enabledLabels.value);
    const key = label.toLowerCase();
    if (next.has(key)) next.delete(key); else next.add(key);
    enabledLabels.value = next;
  }
  function toggleUnread(): void { unreadOnly.value = !unreadOnly.value; }
  function clearAllFilters(): void { enabledLabels.value = new Set(); unreadOnly.value = false; }

  const barLabels = computed<string[]>(() => deriveBarLabels(visibleRows.value ?? []));

  const labelFilteredRows = computed<Row[] | null>(() => {
    const base = visibleRows.value;
    if (!base) return null;
    return filterChannelRows(base, {
      unreadOnly: unreadOnly.value,
      enabledLabels: enabledLabels.value,
    });
  });

  return { barLabels, enabledLabels, unreadOnly, toggleLabel, toggleUnread, clearAllFilters, labelFilteredRows };
}
