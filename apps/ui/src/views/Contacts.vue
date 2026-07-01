<script setup lang="ts">

import {
  getOrCreateXmtpClient, peerEthAddressOfDm, shortAddress, stampAvatarUrl,
} from '../lib/xmtp';
import { readProfile, loadCachedProfile } from '../lib/profile';
import ViewHost from '@stage-labs/kit/vue/view-host';
import type { ListViewNode } from '@stage-labs/kit/kit';
import { contactRow, CONTACT_PRESS } from '@stage-labs/views';

interface Contact { address: string; convId: string }

const router = useRouter();
const contacts = ref<Contact[] | null>(null);
const loading = ref<boolean>(true);
const error = ref<string>('');

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
  finally { loading.value = false; }
});

const listNode = computed<ListViewNode>(() => ({
  type: 'ListView',
  children: (contacts.value ?? []).map(c =>
    contactRow({
      name: peerName(c.address) ?? c.address,
      avatarUri: stampAvatarUrl(c.address, 80),
      handle: peerName(c.address) ? shortAddress(c.address) : undefined,
      payload: { convId: c.convId },
    }),
  ),
}));

const actions = {
  [CONTACT_PRESS]: (payload: Record<string, unknown>): void => {
    const convId = payload.convId;
    if (typeof convId === 'string') void router.push(`/xmtp/${convId}`);
  },
};
</script>

<template>
  <!-- Mobile parity (components/ContactsScreen.tsx): identity-only hoisted topnav,
       no search bar, a plain contact list, and a centered loading/empty message.
       Mobile's Contacts tab has NO right-slot actions and NO search toggle. -->
  <Col surface="surface" class="flex-1 min-h-0 pt-1">
    <Col v-if="error" align="center" justify="center" class="flex-1 text-sm text-metro-fg-light dark:text-metro-fg-dark px-6">
      {{ error }}
    </Col>
    <Col v-else-if="!contacts || contacts.length === 0" :flex="1" align="center" justify="center" class="px-6 py-12">
      <Text size="md" color="secondary" class="text-center">
        {{ loading ? 'Loading contacts…' : 'No contacts yet. Start a chat to add one.' }}
      </Text>
    </Col>
    <Scroll v-else class="flex-1 min-h-0">
      <ViewHost :node="listNode" :actions="actions" />
    </Scroll>
  </Col>
</template>
