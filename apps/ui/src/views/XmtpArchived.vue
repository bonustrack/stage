<script setup lang="ts">

import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ChatKitRenderer from '@stage-labs/kit/vue/chatkit-renderer';
import { emptyState } from '@stage-labs/views';
import { basicRoot } from '@/lib/chatkitRow';
import { cachedRows, hydrateCachedRows, type CachedRow } from '../lib/channelsCache';
import { loadArchivedIds, subscribeArchived } from '../lib/archived';

const router = useRouter();
const palette = useKitPalette();

const archived = ref<Set<string>>(loadArchivedIds());
let unsub: (() => void) | null = null;

onMounted(() => {
  hydrateCachedRows();
  unsub = subscribeArchived(() => { archived.value = loadArchivedIds(); });
});
onUnmounted(() => { unsub?.(); });

interface ArchivedRow extends CachedRow {
  title: string;
  lastTs: number | null;
  lastPreview: string;
  avatarAddress: string | null;
  avatarUri: string | null;
}

const rows = computed<ArchivedRow[]>(() => {
  const all = (cachedRows.value ?? []) as ArchivedRow[];
  return all.filter(r => archived.value.has(r.convId));
});

function open(convId: string): void { void router.push(`/xmtp/${convId}`); }

const emptyNode = basicRoot(emptyState({ title: 'No archived conversations.' }));
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <Row
      surface="toolbar"
      align="center"
      :gap="8"
      :padding="{ x: 12, y: 10 }"
      :style="{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: palette.border }"
    >
      <Pressable tag="button" type="button" class="p-1" @click="router.back()">
        <Icon name="arrowLeft" :size="22" :color="palette.text" />
      </Pressable>
      <Title size="sm">Archived</Title>
    </Row>

    <Col v-if="rows.length === 0" align="center" justify="center" class="flex-1">
      <ChatKitRenderer :node="emptyNode" />
    </Col>
    <ul v-else class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-6">
      <li v-for="r in rows" :key="r.convId">
        <ChannelRow
          :avatar-address="r.avatarAddress"
          :avatar-uri="r.avatarUri"
          :title="r.title"
          :last-ts="r.lastTs"
          :last-preview="r.lastPreview"
          :unread-count="0"
          @open="open(r.convId)"
        />
      </li>
    </ul>
  </Col>
</template>
