<script setup lang="ts">

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ViewHost from '@stage-labs/kit/vue/view-host';
import type { ListViewNode } from '@stage-labs/kit/kit';
import { settingsHeader, settingsNavRow, SCREEN_BACK, SETTINGS_NAV_PRESS } from '@stage-labs/views';

const router = useRouter();
const palette = useKitPalette();

const headerNode = computed(() => settingsHeader({
  title: 'Experimental',
  backColor: palette.text,
  surface: palette.toolbarBg,
  borderColor: palette.border,
  safeTop: 0,
}));

const node = computed<ListViewNode>(() => ({
  type: 'ListView',
  children: [settingsNavRow({
    label: 'Developer',
    iconStart: 'beaker',
    pressType: SETTINGS_NAV_PRESS,
    payload: { to: '/settings/developer' },
  })],
}));

const actions = {
  [SCREEN_BACK]: (): void => { router.back(); },
  [SETTINGS_NAV_PRESS]: (payload: Record<string, unknown>): void => {
    const to = payload.to;
    if (typeof to === 'string') void router.push(to);
  },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <ViewHost :node="headerNode" :actions="actions" />

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
      <Col class="w-[calc(100%-2rem)] mx-4 mt-5">
        <ViewHost :node="node" :actions="actions" />
      </Col>
    </Col>
  </Col>
</template>
