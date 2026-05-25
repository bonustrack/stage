<script setup lang="ts">
/** Channels tab — XMTP conversations the local wallet is a member of.
 *  Mirrors apps/app/app/(tabs)/index.tsx (search, stamp avatars, member stack for groups). */

import type { Conversation } from '@xmtp/browser-sdk';
import {
  getOrCreateXmtpClient, peerEthAddressOfDm, groupMemberEthAddresses, stampBoxAvatarUrl,
} from '../lib/xmtp';

interface Row {
  convId: string;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  peerAddress: string | null;
  memberAddresses: string[];
}

const router = useRouter();
const rows = ref<Row[] | null>(null);
const error = ref<string>('');
const query = ref<string>('');

function fmtTs(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

async function summarize(conv: Conversation): Promise<Row> {
  const msgs = await conv.messages({ limit: 1n }).catch(() => []);
  const last = msgs[msgs.length - 1];
  let preview = '';
  if (last) {
    const decoded: unknown = last.content;
    preview = typeof decoded === 'string' ? decoded : `[${last.contentType?.typeId ?? 'unknown'}]`;
  }
  const peerAddress = await peerEthAddressOfDm(conv);
  const memberAddresses = peerAddress ? [] : await groupMemberEthAddresses(conv);
  const title = peerAddress
    ?? (memberAddresses.length > 0
      ? `${memberAddresses.length} member${memberAddresses.length === 1 ? '' : 's'}`
      : conv.id.slice(0, 12));
  return {
    convId: conv.id,
    title,
    lastTs: last ? Number(last.sentAtNs / 1_000_000n) : null,
    lastPreview: preview.slice(0, 80),
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

onMounted(async () => {
  try {
    const client = await getOrCreateXmtpClient('production');
    await client.conversations.syncAll();
    const convs = await client.conversations.list();
    const summarized = await Promise.all(convs.map(summarize));
    summarized.sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
    rows.value = summarized;
  } catch (e) { error.value = (e as Error).message; }
});

function open(convId: string): void { void router.push(`/xmtp/${convId}`); }
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <div class="px-3 pt-3 pb-2">
      <input
        v-model="query"
        type="text"
        placeholder="Search channels…"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        class="w-full bg-metro-surface-light dark:bg-metro-surface-dark
          border border-metro-border-light dark:border-metro-border-dark rounded-lg px-3 py-2 text-sm
          text-metro-fg-light dark:text-metro-fg-dark outline-none
          placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark"
      />
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
          <div class="w-9 h-9 shrink-0">
            <img v-if="r.peerAddress"
              :src="stampBoxAvatarUrl(r.peerAddress, 72)"
              alt=""
              class="w-9 h-9 rounded-full bg-metro-border-dark"
            />
            <img v-else-if="r.memberAddresses.length === 1"
              :src="stampBoxAvatarUrl(r.memberAddresses[0], 72)"
              alt=""
              class="w-9 h-9 rounded-full bg-metro-border-dark"
            />
            <div v-else class="relative w-9 h-9">
              <img v-for="(addr, i) in r.memberAddresses.slice(0, Math.min(3, r.memberAddresses.length))"
                :key="addr.toLowerCase()"
                :src="stampBoxAvatarUrl(addr, 48)"
                alt=""
                :style="{ left: `${i * 10}px` }"
                class="absolute top-1.5 w-6 h-6 rounded-full bg-metro-border-dark
                  ring-2 ring-metro-surface-light dark:ring-metro-surface-dark"
              />
              <div v-if="r.memberAddresses.length > 3"
                :style="{ left: `${3 * 10}px` }"
                class="absolute top-1.5 w-6 h-6 rounded-full bg-metro-sub-dark
                  ring-2 ring-metro-surface-light dark:ring-metro-surface-dark
                  flex items-center justify-center text-[10px] font-head text-white">
                +{{ r.memberAddresses.length - 3 }}
              </div>
              <div v-if="r.memberAddresses.length === 0"
                class="w-9 h-9 rounded-full bg-metro-sub-dark flex items-center justify-center text-white text-base">·</div>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-mono text-sm text-metro-fg-light dark:text-metro-fg-dark truncate">
              {{ r.title }}
            </div>
            <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark truncate mt-0.5">
              {{ r.lastPreview || '(no messages yet)' }}
            </div>
          </div>
          <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark shrink-0 ml-2">
            {{ fmtTs(r.lastTs) }}
          </div>
        </button>
      </li>
    </ul>
  </div>
</template>
