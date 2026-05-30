<script setup lang="ts">
/** Contacts tab — distinct DM peers extracted from the local XMTP inbox.
 *  Mirrors apps/app/app/(tabs)/contacts.tsx. */

import {
  getOrCreateXmtpClient, peerEthAddressOfDm, stampBoxAvatarUrl, shortAddress,
} from '../lib/xmtp';
import { useSearchResolution } from '../lib/useSearchResolution';
import { Col } from '../components/layout';

interface Contact { address: string; convId: string }

const router = useRouter();
const contacts = ref<Contact[] | null>(null);
const error = ref<string>('');
const query = ref<string>('');
const { searchResolution, openSearchedProfile } = useSearchResolution(query, router);

const filtered = computed(() => {
  if (!contacts.value) return null;
  const q = query.value.trim().toLowerCase();
  if (!q) return contacts.value;
  return contacts.value.filter(c => c.address.toLowerCase().includes(q));
});

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
  <Col class="min-h-screen">
    <div class="px-4 pt-4 pb-2">
      <h1 class="font-head text-xl text-metro-head-light dark:text-metro-head-dark">Contacts</h1>
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
    <Col v-if="error" align="center" justify="center" class="flex-1 text-sm text-metro-fg-light dark:text-metro-fg-dark px-6">
      {{ error }}
    </Col>
    <Col v-else-if="!contacts" align="center" justify="center" class="flex-1 text-xs text-metro-sub-light dark:text-metro-sub-dark">
      Loading contacts…
    </Col>
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
  </Col>
</template>
