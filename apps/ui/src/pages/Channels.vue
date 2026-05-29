<script setup lang="ts">
/** Channels tab — XMTP conversations the local wallet is a member of.
 *  Mirrors apps/app/app/(tabs)/index.tsx (search, stamp avatars, unread
 *  badges, persisted cache so the list renders before XMTP boots). */

import { getOrCreateXmtpClient, createAskQuestionGroup, ASK_QUESTION_MEMBERS, stampBoxAvatarUrl } from '../lib/xmtp';
import { cachedRows, hydrateCachedRows, markConvRead, markConvUnread } from '../lib/channelsCache';
import { type ChannelRow as Row } from '../lib/channelsSummarize';
import { startChannelStream, type ChannelStreamHandles } from '../lib/useChannelStream';
import { useSearchResolution } from '../lib/useSearchResolution';
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
const { searchResolution, openSearchedProfile } = useSearchResolution(query, router);

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

/** Per-row context menu (right-click on web) with the Mark read/unread toggle.
 *  Positioned at the cursor; dismissed on outside click / scroll / Escape. */
const rowMenu = ref<{ convId: string; title: string; isUnread: boolean; x: number; y: number } | null>(null);
function openRowMenu(r: Row, ev: MouseEvent): void {
  /** Clamp X so the ~200px menu never spills off the right edge. */
  const maxX = (typeof window !== 'undefined' ? window.innerWidth : 9999) - 200;
  rowMenu.value = {
    convId: r.convId,
    title: r.title,
    isUnread: r.unreadCount > 0 || !!r.markedUnread,
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

/** Embedded widget opens on the Intercom-style "Ask a question" home; the
 *  standalone site goes straight to the channel list (mobile-app UX) and uses
 *  the app's bottom TabBar (Channels/Contacts/Profile/Settings) for nav. */
const view = ref<'home' | 'messages'>(embedded ? 'home' : 'messages');
function openDocs(): void { window.open('https://docs.snapshot.box', '_blank', 'noopener,noreferrer'); }
const cardClass = 'w-full max-w-sm flex items-center gap-3 px-4 py-4 rounded-2xl text-left '
  + 'border border-metro-border-light dark:border-metro-border-dark '
  + 'text-metro-head-light dark:text-metro-head-dark '
  + 'hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors disabled:opacity-60';
</script>

<template>
  <div class="h-[100dvh] flex flex-col relative" :class="embedded ? '' : 'pb-[60px]'">
    <!-- Topnav: page title, refresh, and (embedded only) a close button at the
         end, so the channels homepage has a single topnav like conversations. -->
    <div class="h-[56px] box-border flex items-center shrink-0 gap-1 pl-2 pr-1
      bg-metro-bg-light dark:bg-metro-bg-dark
      border-b border-metro-border-light dark:border-metro-border-dark">
      <span class="flex-1 font-head text-[17px] text-metro-head-light dark:text-metro-head-dark pl-2">
        {{ embedded ? (view === 'messages' ? 'Messages' : 'Home') : 'Channels' }}
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

    <!-- HOME: the "Ask a question" action card. Messages/Docs live in the footer nav. -->
    <div v-if="view === 'home'" class="flex-1 flex flex-col items-center justify-center gap-3 px-6">
      <button type="button" :disabled="creatingAsk" :class="cardClass" @click="onAskPress">
        <HeroIcon name="chat" :size="24" class="shrink-0 text-metro-fg-light dark:text-metro-fg-dark" />
        <span class="flex-1 text-[17px] font-sans">{{ creatingAsk ? 'Creating group…' : 'Ask a question' }}</span>
        <div class="flex items-center shrink-0">
          <img
            v-for="(addr, i) in ASK_QUESTION_MEMBERS"
            :key="addr"
            :src="stampBoxAvatarUrl(addr, 56)"
            alt=""
            class="w-7 h-7 rounded-full bg-metro-border-light dark:bg-metro-border-dark
              border-2 border-metro-bg-light dark:border-metro-bg-dark"
            :class="i === 0 ? '' : '-ml-2'"
          />
        </div>
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
            :marked-unread="r.markedUnread"
            @open="open(r.convId)"
            @menu="(ev) => openRowMenu(r, ev)"
          />
        </li>
      </ul>
    </template>

    <!-- Footer nav (Intercom-style): Home / Messages / Docs — embedded widget only.
         The standalone site uses the app-wide TabBar instead (mobile-app UX). -->
    <div v-if="embedded" class="shrink-0 flex items-stretch border-t border-metro-border-light dark:border-metro-border-dark
      bg-metro-bg-light dark:bg-metro-bg-dark">
      <button type="button" class="flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors"
        :class="view === 'home' ? 'text-metro-head-light dark:text-metro-head-dark' : 'text-metro-sub-light dark:text-metro-sub-dark'"
        @click="view = 'home'">
        <HeroIcon name="home" :size="22" />
        <span class="text-[15px] font-sans">Home</span>
      </button>
      <button type="button" class="flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors"
        :class="view === 'messages' ? 'text-metro-head-light dark:text-metro-head-dark' : 'text-metro-sub-light dark:text-metro-sub-dark'"
        @click="view = 'messages'">
        <HeroIcon name="list" :size="22" />
        <span class="text-[15px] font-sans">Messages</span>
      </button>
      <button type="button"
        class="flex-1 flex flex-col items-center gap-1 py-2.5 text-metro-sub-light dark:text-metro-sub-dark
          hover:text-metro-head-light dark:hover:text-metro-head-dark transition-colors"
        @click="openDocs">
        <HeroIcon name="document" :size="22" />
        <span class="text-[15px] font-sans">Docs</span>
      </button>
    </div>

    <!-- Per-row context menu: Mark as read / unread (cross-device via XMTP consent). -->
    <template v-if="rowMenu">
      <div class="fixed inset-0 z-40" @click="closeRowMenu" @contextmenu.prevent="closeRowMenu" />
      <div
        class="fixed z-50 min-w-[180px] py-1 rounded-lg shadow-lg
          bg-metro-bg-light dark:bg-metro-surface-dark
          border border-metro-border-light dark:border-metro-border-dark"
        :style="{ left: rowMenu.x + 'px', top: rowMenu.y + 'px' }"
      >
        <button
          type="button"
          class="w-full text-left px-3 py-2 text-sm
            text-metro-head-light dark:text-metro-head-dark
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
          @click="toggleRowUnread"
        >
          {{ rowMenu.isUnread ? 'Mark as read' : 'Mark as unread' }}
        </button>
      </div>
    </template>
  </div>
</template>
