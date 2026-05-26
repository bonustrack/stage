<script setup lang="ts">
/** Channels tab — XMTP conversations the local wallet is a member of.
 *  Mirrors apps/app/app/(tabs)/index.tsx (search, stamp avatars, unread
 *  badges, persisted cache so the list renders before XMTP boots). */

import { getOrCreateXmtpClient, createAskQuestionGroup } from '../lib/xmtp';
import { cachedRows, hydrateCachedRows } from '../lib/channelsCache';
import { type ChannelRow as Row } from '../lib/channelsSummarize';
import { startChannelStream, type ChannelStreamHandles } from '../lib/useChannelStream';
import { isAddressLike, isDomainLike, resolveDomain } from '../lib/stamp';

const router = useRouter();
/** Embedded (iframed) = widget; no tab bar, so the Ask pill sits at the
 *  very bottom instead of reserving the tab-bar gap. */
const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
const rows = ref<Row[] | null>(hydrateCachedRows() as Row[] | null);
const error = ref<string>('');
const query = ref<string>('');
const creatingAsk = ref(false);
const refreshing = ref(false);
const searchResolution = ref<{ status: 'idle' | 'resolving' | 'resolved' | 'missed'; address: string | null }>({ status: 'idle', address: null });

/** Sync rows ref with the shared cache so other surfaces (markConvRead in
 *  XmtpConversation) propagate changes here without a refetch. */
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

const filtered = computed(() => {
  if (!rows.value) return null;
  const q = query.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter(r =>
    r.title.toLowerCase().includes(q)
    || r.lastPreview.toLowerCase().includes(q)
    || (r.peerAddress?.toLowerCase().includes(q) ?? false)
    || r.memberAddresses.some(a => a.toLowerCase().includes(q)),
  );
});

/** Watch the search input — when it contains a domain like `fabien.eth`,
 *  resolve via Stamp so the user gets an "Open profile" suggestion below
 *  the list. Pure address inputs short-circuit (no resolution needed). */
watch(query, (q) => {
  const v = q.trim();
  if (!v) { searchResolution.value = { status: 'idle', address: null }; return; }
  if (isAddressLike(v)) { searchResolution.value = { status: 'resolved', address: v }; return; }
  if (!isDomainLike(v)) { searchResolution.value = { status: 'idle', address: null }; return; }
  searchResolution.value = { status: 'resolving', address: null };
  void resolveDomain(v).then(addr => {
    /** Race protection — bail if the user kept typing. */
    if (query.value.trim() !== v) return;
    searchResolution.value = addr
      ? { status: 'resolved', address: addr }
      : { status: 'missed', address: null };
  });
}, { flush: 'post' });

function openSearchedProfile(): void {
  const addr = searchResolution.value.address;
  if (addr) void router.push(`/user/${addr}`);
}

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
</script>

<template>
  <div class="h-[100dvh] flex flex-col relative">
    <div class="shrink-0 px-3 pt-3 pb-2 flex items-center gap-2
      bg-metro-bg-light dark:bg-metro-bg-dark">
      <input
        v-model="query"
        type="text"
        placeholder="Search channels or paste 0x… / name.eth…"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        class="flex-1 bg-metro-surface-light dark:bg-metro-surface-dark
          border border-metro-border-light dark:border-metro-border-dark rounded-lg px-3 py-2 text-sm
          text-metro-fg-light dark:text-metro-fg-dark outline-none
          placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark"
      />
      <button
        type="button"
        :disabled="refreshing"
        class="p-2 rounded-lg text-metro-sub-light dark:text-metro-sub-dark
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark
          disabled:opacity-50"
        :title="refreshing ? 'Refreshing…' : 'Refresh channels'"
        @click="refreshFromNetwork"
      >
        <HeroIcon name="arrowDown" :size="16" :class="refreshing ? 'animate-spin' : ''" />
      </button>
    </div>
    <SearchResolution
      :status="searchResolution.status"
      :address="searchResolution.address"
      :query="query"
      @open="openSearchedProfile"
    />

    <div v-if="error" class="flex-1 flex items-center justify-center text-sm text-metro-fg-light dark:text-metro-fg-dark px-6">
      {{ error }}
    </div>
    <div v-else-if="!rows" class="flex-1 flex items-center justify-center text-xs text-metro-sub-light dark:text-metro-sub-dark">
      Initialising XMTP…
    </div>
    <ul v-else class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-[150px]">
      <li v-if="filtered && filtered.length === 0" class="p-8 text-center text-sm text-metro-sub-light dark:text-metro-sub-dark">
        {{ query ? `No matches for "${query}"` : 'No conversations yet. Share your address from Settings to start one.' }}
      </li>
      <li v-for="r in filtered ?? rows" :key="r.convId">
        <ChannelRow
          :avatar-address="r.avatarAddress"
          :avatar-uri="r.avatarUri"
          :title="r.title"
          :last-ts="r.lastTs"
          :last-preview="r.lastPreview"
          :unread-count="r.unreadCount"
          @open="open(r.convId)"
        />
      </li>
    </ul>
    <!-- Floating "Ask a question" pill — full-width above the bottom TabBar. -->
    <button
      type="button"
      :disabled="creatingAsk"
      class="fixed left-4 right-4 z-30
        bg-metro-head-light dark:bg-metro-head-dark
        text-metro-bg-light dark:text-metro-bg-dark
        text-[18px] font-sans py-3 rounded-full
        disabled:opacity-60 hover:opacity-90 transition-opacity"
      :class="isEmbedded ? 'bottom-4' : 'bottom-[76px]'"
      @click="onAskPress"
    >
      {{ creatingAsk ? 'Creating group…' : 'Ask a question' }}
    </button>
  </div>
</template>
