<script setup lang="ts">

import { computed } from 'vue';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ViewHost from '@stage-labs/kit/vue/view-host';
import type { ListViewNode } from '@stage-labs/kit/kit';
import { backAction, settingsHeader, settingsMenuNode, settingsNavAction } from '@stage-labs/views';
import { capabilities } from '@/lib/capabilities';
import pkg from '../../package.json';

const palette = useKitPalette();

const APP_VERSION = pkg.version;

const headerNode = computed(() => settingsHeader({
  title: 'Settings',
  backColor: palette.text,
  surface: palette.toolbarBg,
  borderColor: palette.border,
  safeTop: 0,
}));

const node = computed<ListViewNode>(() => settingsMenuNode());

const actions = {
  ...backAction(capabilities),
  ...settingsNavAction(capabilities),
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <ViewHost :node="headerNode" :actions="actions" />

    <Scroll class="flex-1 min-h-0 no-scrollbar pb-8">
      <Col class="w-[calc(100%-2rem)] mx-4 mt-2">
        <ViewHost :node="node" :actions="actions" />
      </Col>

      <Col class="mt-6 mb-4 text-center">
        <Text size="3xs" class="text-metro-sub-light dark:text-metro-sub-dark">
          Stage · v{{ APP_VERSION }}
        </Text>
      </Col>
    </Scroll>
  </Col>
</template>
