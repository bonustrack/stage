<script setup lang="ts">

import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { basicRoot, emptyState, screenHeader, SCREEN_BACK } from '@stage-labs/views';
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

const headerNode = computed(() =>
  basicRoot(screenHeader({
    title: 'Archived',
    titleStyle: { kind: 'title', size: 'sm', color: palette.link },
    backColor: palette.text,
    safeTop: 0,
    surface: palette.toolbarBg,
    borderColor: palette.border,
  })),
);
const headerActions = {
  [SCREEN_BACK]: (): void => { router.back(); },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <ViewHost :node="headerNode" :actions="headerActions" />

    <Col v-if="rows.length === 0" align="center" justify="center" class="flex-1">
      <ViewHost :node="emptyNode" />
    </Col>
    <ul v-else class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-6">
      <li v-for="r in rows" :key="r.convId">
        <ChannelRow
          :avatar-address="r.avatarAddress"
          :avatar-uri="r.avatarUri"
          :title="r.title"
          :last-ts="r.lastTs"
          :last-preview="r.lastPreview || '(no messages yet)'"
          :unread-count="0"
          @open="open(r.convId)"
        />
      </li>
    </ul>
  </Col>
</template>
