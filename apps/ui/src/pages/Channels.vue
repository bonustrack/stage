<script setup lang="ts">
/** Channels tab — XMTP conversations the local wallet is a member of.
 *  Mirrors apps/app/app/(tabs)/index.tsx (search, stamp avatars, unread
 *  badges, persisted cache so the list renders before XMTP boots). */

import { getOrCreateXmtpClient, createAskQuestionGroup } from '../lib/xmtp';
import { cachedRows, hydrateCachedRows } from '../lib/channelsCache';
import { type ChannelRow as Row } from '../lib/channelsSummarize';
import { startChannelStream, type ChannelStreamHandles } from '../lib/useChannelStream';
import { isAddressLike, isDomainLike, resolveDomain } from '../lib/stamp';
import { runningInIframe, postCloseToParent } from '../lib/embedBridge';

const router = useRouter();
/** Embedded (iframed) = widget. Hides the search topnav + drops the Ask
 *  pill to the very bottom (no tab-bar gap to reserve). */
const embedded = runningInIframe();
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

/** Widget/site home shows 3 actions; "Messages" switches to the channel list. */
const view = ref<'home' | 'messages'>('home');
function openDocs(): void { window.open('https://docs.snapshot.box', '_blank', 'noopener,noreferrer'); }
const cardClass = 'w-full max-w-sm flex items-center gap-3 px-4 py-4 rounded-2xl text-left '
  + 'bg-metro-surface-light dark:bg-metro-surface-dark '
  + 'border border-metro-border-light dark:border-metro-border-dark '
  + 'text-metro-head-light dark:text-metro-head-dark '
  + 'hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors disabled:opacity-60';
</script>

<template>
  <div class="h-[100dvh] flex flex-col relative">
    <!-- Topnav: page title, refresh, and (embedded only) a close button at the
         end, so the channels homepage has a single topnav like conversations. -->
    <div class="h-[56px] box-border flex items-center shrink-0 gap-1 pl-2 pr-1
      bg-metro-bg-light dark:bg-metro-bg-dark
      border-b border-metro-border-light dark:border-metro-border-dark">
      <button
        v-if="view === 'messages'"
        type="button"
        class="px-2 py-2 text-metro-fg-light dark:text-metro-fg-dark"
        title="Back"
        @click="view = 'home'"
      >
        <HeroIcon name="arrowLeft" :size="20" />
      </button>
      <span class="flex-1 font-head text-[17px] text-metro-head-light dark:text-metro-head-dark"
        :class="view === 'messages' ? '' : 'pl-2'">
        {{ view === 'messages' ? 'Messages' : 'Home' }}
      </span>
      <button
        v-if="!embedded && view === 'messages'"
        type="button"
        :disabled="refreshing"
        class="p-2 rounded-lg text-metro-sub-light dark:text-metro-sub-dark
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark disabled:opacity-50"
        :title="refreshing ? 'Refreshing…' : 'Refresh channels'"
        @click="refreshFromNetwork"
      >
        <HeroIcon name="arrowDown" :size="16" :class="refreshing ? 'animate-spin' : ''" />
      </button>
      <button
        v-if="embedded"
        type="button"
        class="px-2 py-2 text-metro-fg-light dark:text-metro-fg-dark"
        title="Close"
        @click="postCloseToParent"
      >
        <HeroIcon name="x" :size="20" />
      </button>
    </div>

    <!-- HOME: three action cards (Ask a question / Messages / Docs). -->
    <div v-if="view === 'home'" class="flex-1 flex flex-col items-center justify-center gap-3 px-6">
      <button type="button" :disabled="creatingAsk" :class="cardClass" @click="onAskPress">
        <HeroIcon name="chat" :size="24" class="shrink-0 text-metro-fg-light dark:text-metro-fg-dark" />
        <span class="flex-1 text-[17px] font-sans">{{ creatingAsk ? 'Creating group…' : 'Ask a question' }}</span>
      </button>
      <button type="button" :class="cardClass" @click="view = 'messages'">
        <HeroIcon name="list" :size="24" class="shrink-0 text-metro-fg-light dark:text-metro-fg-dark" />
        <span class="flex-1 text-[17px] font-sans">Messages</span>
      </button>
      <button type="button" :class="cardClass" @click="openDocs">
        <HeroIcon name="document" :size="24" class="shrink-0 text-metro-fg-light dark:text-metro-fg-dark" />
        <span class="flex-1 text-[17px] font-sans">Docs</span>
      </button>
      <div v-if="error" class="text-xs text-metro-err mt-1">{{ error }}</div>
    </div>

    <!-- MESSAGES: search (standalone) + the channel list. -->
    <template v-else>
      <div v-if="!embedded" class="shrink-0 px-4 pt-3 pb-2 bg-metro-bg-light dark:bg-metro-bg-dark">
        <input
          v-model="query"
          type="text"
          placeholder="Search channels or paste 0x… / name.eth…"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          class="w-full bg-metro-surface-light dark:bg-metro-surface-dark
            border border-metro-border-light dark:border-metro-border-dark rounded-lg px-3 py-2 text-sm
            text-metro-fg-light dark:text-metro-fg-dark outline-none
            placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark"
        />
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
      <div v-else-if="!rows" class="flex-1 flex items-center justify-center text-metro-head-light dark:text-metro-head-dark">
        <Spinner :size="28" />
      </div>
      <ul v-else class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-6">
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
    </template>
  </div>
</template>
