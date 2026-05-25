<script setup lang="ts">
/** Channels tab — XMTP conversations the local wallet is a member of.
 *  Mirrors apps/app/app/(tabs)/index.tsx (search, stamp avatars, unread
 *  badges, persisted cache so the list renders before XMTP boots). */

import type { Conversation } from '@xmtp/browser-sdk';
import {
  getOrCreateXmtpClient, peerEthAddressOfDm, groupMemberEthAddresses, stampBoxAvatarUrl,
  createAskQuestionGroup, getLastReadNs, memberInboxToAddressMap,
} from '../lib/xmtp';
import {
  cachedRows, hydrateCachedRows, setCachedRows, type CachedRow,
} from '../lib/channelsCache';
import { isAddressLike, isDomainLike, resolveDomain } from '../lib/stamp';

interface Row extends CachedRow {
  title: string;
  lastTs: number | null;
  lastPreview: string;
  /** stamp.fyi avatar address — follows the latest sender, falls back to
   *  the peer (DMs) or first other member (groups). */
  avatarAddress: string | null;
  /** Cached inbox-id → eth address map so streamAllMessages can resolve a
   *  new sender's avatar without an extra round-trip. */
  inboxToAddr: Record<string, string>;
  selfInboxId: string;
  peerAddress: string | null;
  memberAddresses: string[];
}

const router = useRouter();
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

function fmtTs(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

async function summarize(conv: Conversation, selfInboxId: string): Promise<Row> {
  /** Pull the latest 50 messages — enough for an accurate unread count on
   *  active convs without ballooning per-row fetch time. */
  const msgs = await conv.messages({ limit: 50n }).catch(() => []);
  /** The browser SDK returns messages in chronological (oldest-first) order;
   *  flip so msgs[0] is the latest, matching the mobile codepath. */
  const recent = [...msgs].reverse();
  const last = recent[0];
  let preview = '';
  if (last) {
    const decoded: unknown = last.content;
    preview = typeof decoded === 'string' ? decoded : `[${last.contentType?.typeId ?? 'unknown'}]`;
  }
  const peerAddress = await peerEthAddressOfDm(conv);
  const memberAddresses = peerAddress ? [] : await groupMemberEthAddresses(conv);
  const inboxToAddr = await memberInboxToAddressMap(conv);
  const totalMembers = memberAddresses.length + 1;
  const groupName = (conv as unknown as { name?: string | (() => Promise<string>) }).name;
  const resolvedName = typeof groupName === 'function' ? await groupName() : groupName ?? '';
  const title = peerAddress
    ?? (resolvedName && resolvedName.trim()
      ? resolvedName.trim()
      : memberAddresses.length > 0
        ? `${totalMembers} member${totalMembers === 1 ? '' : 's'}`
        : conv.id.slice(0, 12));
  const lastSenderAddress = last?.senderInboxId
    ? inboxToAddr[last.senderInboxId] ?? null
    : null;
  const avatarAddress = lastSenderAddress ?? peerAddress ?? memberAddresses[0] ?? null;
  const lastReadNs = getLastReadNs(conv.id);
  let unreadCount = 0;
  for (const m of recent) {
    const sentNs = Number(m.sentAtNs);
    if (!sentNs || sentNs <= lastReadNs) break;
    if (m.senderInboxId === selfInboxId) continue;
    unreadCount += 1;
  }
  return {
    convId: conv.id,
    title,
    lastTs: last ? Number(last.sentAtNs / 1_000_000n) : null,
    lastPreview: preview.slice(0, 80),
    avatarAddress,
    inboxToAddr,
    unreadCount,
    lastReadNs,
    selfInboxId,
    peerAddress,
    memberAddresses,
  };
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

type StreamHandle = { end: () => Promise<unknown> };
let stopConvStream: StreamHandle | null = null;
let stopMsgStream: StreamHandle | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let visibilityHandler: (() => void) | null = null;
let refreshFn: (() => Promise<void>) | null = null;

async function refreshFromNetwork(): Promise<void> {
  if (refreshing.value) return;
  refreshing.value = true;
  try { await refreshFn?.(); } finally { refreshing.value = false; }
}

onMounted(async () => {
  try {
    const client = await getOrCreateXmtpClient('production');
    const selfInboxId = client.inboxId ?? '';

    const refresh = async (): Promise<void> => {
      try {
        await client.conversations.syncAll();
        const convs = await client.conversations.list();
        const summarized = await Promise.all(convs.map(c => summarize(c, selfInboxId)));
        summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
        setCachedRows(summarized);
      } catch { /* swallow — backstops fire */ }
    };
    refreshFn = refresh;

    await refresh();

    /** Subscribe to newly-created convs so groups + DMs created while the
     *  tab is mounted show up without a manual refresh. */
    stopConvStream = await client.conversations.stream({
      onValue: async (conv) => {
        if (!conv) return;
        const r = await summarize(conv, selfInboxId);
        const prev = (cachedRows.value as Row[] | null) ?? [];
        setCachedRows([r, ...prev.filter(x => x.convId !== r.convId)]);
      },
      onError: () => { /* backstops will resync */ },
    });

    /** Subscribe to every new message across convs so the per-row preview +
     *  timestamp + unread count update in real time. When the msg arrives
     *  for a conv we haven't summarised yet (peer-initiated), force a
     *  full refresh so it lands in the list. */
    stopMsgStream = await client.conversations.streamAllMessages({
      onValue: async (msg) => {
        if (!msg) return;
        const decoded: unknown = msg.content;
        const preview = typeof decoded === 'string'
          ? decoded
          : `[${msg.contentType?.typeId ?? 'unknown'}]`;
        const lastTs = Number(msg.sentAtNs / 1_000_000n);
        const lastPreview = preview.slice(0, 80);
        const prev = (cachedRows.value as Row[] | null) ?? [];
        const idx = prev.findIndex(r => r.convId === msg.conversationId);
        if (idx === -1) { void refresh(); return; }
        const cur = prev[idx]!;
        const newAvatar = cur.inboxToAddr[msg.senderInboxId ?? ''] ?? cur.avatarAddress;
        const sentNs = Number(msg.sentAtNs);
        const isUnread = sentNs > cur.lastReadNs && msg.senderInboxId !== cur.selfInboxId;
        const unreadCount = isUnread ? cur.unreadCount + 1 : cur.unreadCount;
        const updated: Row = { ...cur, lastTs, lastPreview, avatarAddress: newAvatar, unreadCount };
        setCachedRows([updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)]);
      },
      onError: () => { /* backstops fire */ },
    });

    /** Visibility-based foreground refresh — XMTP streams often die while
     *  the tab is hidden. */
    visibilityHandler = (): void => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    pollTimer = setInterval(() => { void refresh(); }, 30_000);
  } catch (e) {
    if (!rows.value?.length) error.value = (e as Error).message;
  }
});

onUnmounted(() => {
  void stopConvStream?.end();
  void stopMsgStream?.end();
  if (pollTimer) clearInterval(pollTimer);
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
  refreshFn = null;
});

function open(convId: string): void { void router.push(`/xmtp/${convId}`); }
</script>

<template>
  <div class="min-h-screen flex flex-col relative">
    <div class="px-3 pt-3 pb-2 flex items-center gap-2">
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
    <!-- Search resolution suggestion: shows up when the input is an address
         or a resolvable domain. -->
    <button
      v-if="searchResolution.status === 'resolved' && searchResolution.address"
      type="button"
      class="mx-3 mb-2 px-3 py-2 rounded-lg
        bg-metro-fg-light dark:bg-metro-fg-dark
        text-metro-bg-light dark:text-metro-bg-dark
        text-sm text-left hover:opacity-90"
      @click="openSearchedProfile"
    >
      Open profile of {{ searchResolution.address.slice(0, 6) }}…{{ searchResolution.address.slice(-4) }}
    </button>
    <div v-else-if="searchResolution.status === 'resolving'"
      class="mx-3 mb-2 px-3 py-2 text-xs text-metro-sub-light dark:text-metro-sub-dark">
      Resolving…
    </div>
    <div v-else-if="searchResolution.status === 'missed'"
      class="mx-3 mb-2 px-3 py-2 text-xs text-metro-sub-light dark:text-metro-sub-dark">
      No address found for "{{ query }}"
    </div>

    <div v-if="error" class="flex-1 flex items-center justify-center text-sm text-metro-fg-light dark:text-metro-fg-dark px-6">
      {{ error }}
    </div>
    <div v-else-if="!rows" class="flex-1 flex items-center justify-center text-xs text-metro-sub-light dark:text-metro-sub-dark">
      Initialising XMTP…
    </div>
    <ul v-else class="flex-1">
      <li v-if="filtered && filtered.length === 0" class="p-8 text-center text-sm text-metro-sub-light dark:text-metro-sub-dark">
        {{ query ? `No matches for "${query}"` : 'No conversations yet. Share your address from Settings to start one.' }}
      </li>
      <li v-for="r in filtered ?? rows" :key="r.convId">
        <button
          type="button"
          class="w-full text-left flex items-center gap-3 px-3.5 py-3
            bg-metro-surface-light dark:bg-metro-surface-dark
            border-b border-metro-border-light dark:border-metro-border-dark
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
          @click="open(r.convId)"
        >
          <img v-if="r.avatarAddress"
            :src="stampBoxAvatarUrl(r.avatarAddress, 64)"
            alt=""
            class="w-9 h-9 rounded-full bg-metro-border-dark shrink-0"
          />
          <div v-else class="w-9 h-9 rounded-full bg-metro-border-dark shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2">
              <div class="text-sm text-metro-fg-light dark:text-metro-fg-dark truncate flex-1 font-head">
                {{ r.title }}
              </div>
              <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark shrink-0">
                {{ fmtTs(r.lastTs) }}
              </div>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark truncate flex-1">
                {{ r.lastPreview || '(no messages yet)' }}
              </div>
              <div v-if="r.unreadCount > 0"
                class="min-w-[22px] h-5 rounded-full px-1.5
                  bg-metro-fg-light dark:bg-metro-fg-dark
                  text-metro-bg-light dark:text-metro-bg-dark
                  text-[11px] font-head flex items-center justify-center shrink-0">
                {{ r.unreadCount > 99 ? '99+' : r.unreadCount }}
              </div>
            </div>
          </div>
        </button>
      </li>
    </ul>
    <!-- Floating "Ask a question" pill — full-width above the bottom TabBar. -->
    <button
      type="button"
      :disabled="creatingAsk"
      class="fixed left-4 right-4 bottom-[76px] z-30
        bg-metro-fg-light dark:bg-metro-fg-dark
        text-metro-bg-light dark:text-metro-bg-dark
        text-[15px] font-sans py-3 rounded-full shadow-lg
        disabled:opacity-60 hover:opacity-90 transition-opacity"
      @click="onAskPress"
    >
      {{ creatingAsk ? 'Creating group…' : 'Ask a question' }}
    </button>
  </div>
</template>
