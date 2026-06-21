<script setup lang="ts">

import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { cachedRows, hydrateCachedRows, type CachedRow } from '../lib/channelsCache';
import { loadArchivedIds, subscribeArchived } from '../lib/archived';

const router = useRouter();

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
</script>

<template>
  <Col class="h-[100dvh] bg-metro-bg-light dark:bg-metro-bg-dark">
    <Row align="center" class="h-[56px] box-border shrink-0 px-2
      border-b border-metro-border-light dark:border-metro-border-dark">
      <Pressable tag="button" type="button" class="p-1.5" @click="router.back()">
        <Icon name="arrowLeft" :size="22" />
      </Pressable>
      <Col class="flex-1 font-head text-[17px] text-metro-head-light dark:text-metro-head-dark pl-1">
        Archived
      </Col>
    </Row>

    <Col v-if="rows.length === 0" align="center" justify="center"
      class="flex-1 text-sm text-metro-sub-light dark:text-metro-sub-dark px-6">
      No archived conversations.
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
