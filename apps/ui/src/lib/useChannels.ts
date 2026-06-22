
import { ref, computed, watchEffect, onMounted, onUnmounted, type ComputedRef, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { getOrCreateXmtpClient, createAskQuestionGroup } from './xmtp';
import { cachedRows, hydrateCachedRows, markConvRead, markConvUnread } from './channelsCache';
import { toggleArchived, isArchived } from './archived';
import { type ChannelRow as Row } from './channelsSummarize';
import { startChannelStream, type ChannelStreamHandles } from './useChannelStream';
import { useSearchResolution } from './useSearchResolution';
import { runningInIframe } from './embedBridge';

interface RowMenu { convId: string; title: string; isUnread: boolean; x: number; y: number }

export interface ChannelsState {
  router: ReturnType<typeof useRouter>;
  embedded: boolean;
  rows: Ref<Row[] | null>;
  error: Ref<string>;
  query: Ref<string>;
  creatingAsk: Ref<boolean>;
  refreshing: Ref<boolean>;
  searchResolution: ReturnType<typeof useSearchResolution>['searchResolution'];
  openSearchedProfile: ReturnType<typeof useSearchResolution>['openSearchedProfile'];
  filtered: ComputedRef<Row[] | null>;
  view: Ref<'home' | 'messages'>;
  cardClass: string;
  rowMenu: Ref<RowMenu | null>;
  onAskPress: () => Promise<void>;
  refreshFromNetwork: () => Promise<void>;
  open: (convId: string) => void;
  openRowMenu: (r: Row, ev: MouseEvent) => void;
  closeRowMenu: () => void;
  toggleRowUnread: () => void;
  archiveRow: () => void;
  openDocs: () => void;
  goNewGroup: () => void;
  goArchived: () => void;
  goRequests: () => void;
  goProfile: () => void;
  goSettings: () => void;
}

export function useChannels(): ChannelsState {
  const router = useRouter();
  const embedded = runningInIframe();
  const rows = ref<Row[] | null>(hydrateCachedRows() as Row[] | null);
  const error = ref<string>('');
  const query = ref<string>('');
  const creatingAsk = ref(false);
  const refreshing = ref(false);
  const { searchResolution, openSearchedProfile } = useSearchResolution(query, router);

  watchEffect(() => { rows.value = cachedRows.value as Row[] | null; });

  async function onAskPress(): Promise<void> {
    if (creatingAsk.value) return;
    creatingAsk.value = true;
    try {
      const convId = await createAskQuestionGroup();
      void router.push(`/xmtp/${convId}`);
    } catch (e) {
      error.value = (e as Error).message;
    } finally { creatingAsk.value = false; }
  }

  const archivedTick = ref(0);
  const visibleRows = computed(() => {
    void archivedTick.value;
    if (!rows.value) return null;
    return rows.value.filter(r => !isArchived(r.convId));
  });

  const filtered = computed(() => {
    const base = visibleRows.value;
    if (!base) return null;
    const q = query.value.trim().toLowerCase();
    if (!q) return base;
    return base.filter(r =>
      r.title.toLowerCase().includes(q)
      || r.lastPreview.toLowerCase().includes(q)
      || (r.peerAddress?.toLowerCase().includes(q) ?? false)
      || r.memberAddresses.some(a => a.toLowerCase().includes(q)),
    );
  });

  let stream: ChannelStreamHandles | null = null;

  async function refreshFromNetwork(): Promise<void> {
    if (refreshing.value || !stream) return;
    refreshing.value = true;
    try { await stream.refresh(); } finally { refreshing.value = false; }
  }

  onMounted(async () => {
    try {
      const client = await getOrCreateXmtpClient('production');
      stream = await startChannelStream(client);
    } catch (e) {
      if (!rows.value?.length) error.value = (e as Error).message;
    }
  });

  onUnmounted(() => { void stream?.stop(); stream = null; });

  function open(convId: string): void { void router.push(`/xmtp/${convId}`); }

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

  function goNewGroup(): void { void router.push('/xmtp/new-group'); }
  function goArchived(): void { void router.push('/xmtp/archived'); }
  function goRequests(): void { void router.push('/xmtp/requests'); }
  function goProfile(): void { void router.push('/profile'); }
  function goSettings(): void { void router.push('/settings'); }

  const view = ref<'home' | 'messages'>(embedded ? 'home' : 'messages');
  function openDocs(): void { window.open('https://docs.snapshot.box', '_blank', 'noopener,noreferrer'); }
  const cardClass = 'w-full max-w-sm flex items-center gap-3 px-4 py-4 rounded-2xl text-left '
    + 'border border-metro-border-light dark:border-metro-border-dark '
    + 'text-metro-head-light dark:text-metro-head-dark '
    + 'hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors disabled:opacity-60';

  return {
    router, embedded, rows, error, query, creatingAsk, refreshing,
    searchResolution, openSearchedProfile, filtered, view, cardClass, rowMenu,
    onAskPress, refreshFromNetwork, open, openRowMenu, closeRowMenu,
    toggleRowUnread, archiveRow, openDocs, goNewGroup, goArchived, goRequests,
    goProfile, goSettings,
  };
}
