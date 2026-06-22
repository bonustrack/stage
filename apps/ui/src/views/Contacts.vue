<script setup lang="ts">

import {
  getOrCreateXmtpClient, peerEthAddressOfDm, shortAddress,
} from '../lib/xmtp';
import { useSearchResolution } from '../lib/useSearchResolution';
import { readProfile, loadCachedProfile } from '../lib/profile';
import { useEffectiveScheme } from '@/lib/kitTheme';

const scheme = useEffectiveScheme();

interface Contact { address: string; convId: string }

const router = useRouter();
const contacts = ref<Contact[] | null>(null);
const error = ref<string>('');
const query = ref<string>('');
const { searchResolution, openSearchedProfile } = useSearchResolution(query, router);

const peerNames = ref<Record<string, string>>({});
function peerName(address: string): string | null {
  return peerNames.value[address.toLowerCase()] ?? null;
}
function resolvePeerName(address: string): void {
  const lower = address.toLowerCase();
  if (peerNames.value[lower]) return;
  const cached = loadCachedProfile(address)?.name;
  if (cached) peerNames.value = { ...peerNames.value, [lower]: cached };
  void readProfile(address).then((p) => {
    if (p?.name) peerNames.value = { ...peerNames.value, [lower]: p.name };
  });
}

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
    for (const c of dedup) resolvePeerName(c.address);
  } catch (e) { error.value = (e as Error).message; }
});
</script>

<template>
  <Col class="min-h-screen">
    <Col class="px-4 pt-4 pb-2">
      <Title :level="1" class="font-head text-xl text-metro-head-light dark:text-metro-head-dark">Contacts</Title>
    </Col>
    <Col class="px-3 pb-2">
      <Input
        v-model="query"
        :dark="scheme === 'dark'"
        placeholder="Search contacts or paste 0x… / name.eth…"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        class="w-full bg-metro-surface-light dark:bg-metro-surface-dark
          border border-metro-border-light dark:border-metro-border-dark rounded-lg px-3 py-2 text-sm
          text-metro-fg-light dark:text-metro-fg-dark outline-none
          placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark"
      />
    </Col>
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
        <ChannelRow
          :avatar-address="c.address"
          :title="peerName(c.address) ?? c.address"
          :last-ts="null"
          :last-preview="peerName(c.address) ? shortAddress(c.address) : ' '"
          :unread-count="0"
          @open="router.push(`/xmtp/${c.convId}`)"
        />
      </li>
    </ul>
  </Col>
</template>
