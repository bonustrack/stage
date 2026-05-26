<script setup lang="ts">
/** Contacts tab — distinct DM peers extracted from the local XMTP inbox.
 *  Mirrors apps/app/app/(tabs)/contacts.tsx. */

import {
  getOrCreateXmtpClient, peerEthAddressOfDm, stampBoxAvatarUrl, shortAddress,
} from '../lib/xmtp';
import { isAddressLike, isDomainLike, resolveDomain } from '../lib/stamp';

interface Contact { address: string; convId: string }

const router = useRouter();
const contacts = ref<Contact[] | null>(null);
const error = ref<string>('');
const query = ref<string>('');
const searchResolution = ref<{ status: 'idle' | 'resolving' | 'resolved' | 'missed'; address: string | null }>({ status: 'idle', address: null });

const filtered = computed(() => {
  if (!contacts.value) return null;
  const q = query.value.trim().toLowerCase();
  if (!q) return contacts.value;
  return contacts.value.filter(c => c.address.toLowerCase().includes(q));
});

watch(query, (q) => {
  const v = q.trim();
  if (!v) { searchResolution.value = { status: 'idle', address: null }; return; }
  if (isAddressLike(v)) { searchResolution.value = { status: 'resolved', address: v }; return; }
  if (!isDomainLike(v)) { searchResolution.value = { status: 'idle', address: null }; return; }
  searchResolution.value = { status: 'resolving', address: null };
  void resolveDomain(v).then(addr => {
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

onMounted(async () => {
  try {
    const client = await getOrCreateXmtpClient('production');
    await client.conversations.syncAll();
    const convs = await client.conversations.list();
    const resolved = await Promise.all(convs.map(async c => {
      const addr = await peerEthAddressOfDm(c);
      return addr ? { address: addr, convId: c.id } : null;
    }));
    const seen = new Set<string>();
    const dedup: Contact[] = [];
    for (const r of resolved) {
      if (!r) continue;
      const key = r.address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(r);
    }
    dedup.sort((a, b) => a.address.localeCompare(b.address));
    contacts.value = dedup;
  } catch (e) { error.value = (e as Error).message; }
});
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <div class="px-4 pt-4 pb-2">
      <h1 class="font-head text-xl text-metro-fg-light dark:text-metro-fg-dark">Contacts</h1>
    </div>
    <div class="px-3 pb-2">
      <input
        v-model="query"
        type="text"
        placeholder="Search contacts or paste 0x… / name.eth…"
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
    <div v-else-if="!contacts" class="flex-1 flex items-center justify-center text-xs text-metro-sub-light dark:text-metro-sub-dark">
      Loading contacts…
    </div>
    <ul v-else class="flex-1">
      <li v-if="filtered && filtered.length === 0" class="p-8 text-center text-sm text-metro-sub-light dark:text-metro-sub-dark">
        {{ query ? `No matches for "${query}"` : 'No contacts yet. Start a DM from Channels to populate this list.' }}
      </li>
      <li v-for="c in filtered ?? contacts" :key="c.address.toLowerCase()">
        <button
          type="button"
          class="w-full text-left flex items-center gap-3 px-3.5 py-3
            bg-metro-surface-light dark:bg-metro-surface-dark
            border-b border-metro-border-light dark:border-metro-border-dark
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
          @click="router.push(`/xmtp/${c.convId}`)"
        >
          <img
            :src="stampBoxAvatarUrl(c.address, 72)"
            alt=""
            class="w-9 h-9 rounded-full bg-metro-border-dark shrink-0"
          />
          <div class="flex-1 min-w-0">
            <div class="text-sm text-metro-fg-light dark:text-metro-fg-dark truncate">
              {{ c.address }}
            </div>
            <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark mt-0.5">
              {{ shortAddress(c.address) }}
            </div>
          </div>
        </button>
      </li>
    </ul>
  </div>
</template>
