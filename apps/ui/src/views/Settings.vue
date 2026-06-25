<script setup lang="ts">

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import ChatKitRenderer from '@stage-labs/kit/vue/chatkit-renderer';
import type { ListViewNode, WidgetActionRegistry } from '@stage-labs/kit/chatkit';
import { settingsNavRow, SETTINGS_NAV_PRESS } from '@stage-labs/views';
import pkg from '../../package.json';

const router = useRouter();

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
  <Col surface="surface" class="min-h-screen">
    <!-- Hub header mirrors the mobile SettingsMenu title bar. -->
    <Col class="px-4 pt-4 pb-2">
      <Title :level="1" class="font-head text-xl text-metro-head-light dark:text-metro-head-dark">Settings</Title>
    </Col>

    <Col class="w-[calc(100%-2rem)] mx-4 mt-2">
      <ChatKitRenderer :node="node" :registry="registry" />
    </Col>

    <Col class="mt-6 mb-4 text-center">
      <Text size="3xs" class="text-metro-sub-light dark:text-metro-sub-dark">
        Stage · v{{ APP_VERSION }}
      </Text>
    </Col>
  </Col>
</template>
