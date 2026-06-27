<script setup lang="ts">

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { ListViewNode, WidgetActionRegistry } from '@stage-labs/kit/kit';
import { settingsHeader, settingsValueRow, settingsNavRow, SCREEN_BACK, SETTINGS_ACTION_PRESS } from '@stage-labs/views';
import pkg from '../../../package.json';

const router = useRouter();
const palette = useKitPalette();

const headerNode = computed(() => settingsHeader({
  title: 'About',
  backColor: palette.text,
  surface: palette.toolbarBg,
  borderColor: palette.border,
  safeTop: 0,
}));

const GITHUB_URL = 'https://github.com/bonustrack/stage';

const ROWS: { label: string; value: string }[] = [
  { label: 'App', value: 'Stage' },
  { label: 'Version', value: pkg.version },
  { label: 'Build profile', value: import.meta.env.DEV ? 'dev' : 'release' },
];

const metaNode = computed<ListViewNode>(() => ({
  type: 'ListView',
  children: ROWS.map(r => settingsValueRow({ label: r.label, value: r.value })),
}));

const githubNode = computed<ListViewNode>(() => ({
  type: 'ListView',
  children: [settingsNavRow({
    label: 'View Stage on GitHub',
    value: 'bonustrack/stage',
    iconStart: 'code',
    iconEnd: 'external-link',
    pressType: SETTINGS_ACTION_PRESS,
    payload: { url: GITHUB_URL },
  })],
}));

const registry: WidgetActionRegistry = {
  [SCREEN_BACK]: () => { router.back(); },
  [SETTINGS_ACTION_PRESS]: (action) => {
    const url = action.payload.url;
    if (typeof url === 'string') window.open(url, '_blank', 'noopener,noreferrer');
  },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <KitRenderer :node="headerNode" :registry="registry" />

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8 px-4 pt-4">
      <!-- Build + runtime metadata, mirroring the mobile About panel's metadata rows. -->
      <Text variant="secondary" weight="medium" size="xs" class="mb-2">Build + runtime metadata for this install.</Text>
      <KitRenderer :node="metaNode" :registry="registry" />
      <Col class="mt-4">
        <KitRenderer :node="githubNode" :registry="registry" />
      </Col>
    </Col>
  </Col>
</template>
