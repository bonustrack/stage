<script setup lang="ts">

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { ListViewNode, WidgetActionRegistry } from '@stage-labs/kit/kit';
import { settingsNavRow, SETTINGS_NAV_PRESS } from '@stage-labs/views';
import pkg from '../../package.json';

const router = useRouter();
const palette = useKitPalette();

const APP_VERSION = pkg.version;

const ROWS: { icon: string; label: string; to: string }[] = [
  { icon: 'sun', label: 'Display', to: '/settings/display' },
  { icon: 'chat', label: 'Messenger', to: '/settings/messenger' },
  { icon: 'bell', label: 'Notifications', to: '/settings/notifications' },
  { icon: 'wallet', label: 'Wallet', to: '/settings/wallet' },
  { icon: 'key', label: 'Security', to: '/settings/security' },
  { icon: 'beaker', label: 'Experimental', to: '/settings/experimental' },
  { icon: 'questionMarkCircle', label: 'About', to: '/settings/about' },
];

const node = computed<ListViewNode>(() => ({
  type: 'ListView',
  children: ROWS.map(r => settingsNavRow({
    label: r.label,
    iconStart: r.icon,
    pressType: SETTINGS_NAV_PRESS,
    payload: { to: r.to },
  })),
}));

const registry: WidgetActionRegistry = {
  [SETTINGS_NAV_PRESS]: (action) => {
    const to = action.payload.to;
    if (typeof to === 'string') void router.push(to);
  },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <!-- Mobile parity (components/settings/SettingsMenu.tsx -> SystemHeader):
         back arrow + small title, matching every settings subpage header. -->
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
      <Title size="sm">Settings</Title>
    </Row>

    <Scroll class="flex-1 min-h-0 no-scrollbar pb-8">
      <Col class="w-[calc(100%-2rem)] mx-4 mt-2">
        <KitRenderer :node="node" :registry="registry" />
      </Col>

      <Col class="mt-6 mb-4 text-center">
        <Text size="3xs" class="text-metro-sub-light dark:text-metro-sub-dark">
          Stage · v{{ APP_VERSION }}
        </Text>
      </Col>
    </Scroll>
  </Col>
</template>
