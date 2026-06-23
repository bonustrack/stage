<script setup lang="ts">
import { provide, reactive, watchEffect } from 'vue';
import {
  KitThemeKey,
  defaultKitPalette,
  type KitThemeValue,
} from '@stage-labs/kit/vue/theme-context';
import { useEffectiveScheme } from './lib/kitTheme';
import {
  useCustomTheme, customPalette, radiusPx, densityScale, useBaseSize,
} from './lib/theme';

const route = useRoute();
const isEmbedded = runningInIframe();
const TAB_ROUTES = new Set(['channels', 'contacts', 'wallet']);
const showTabs = computed(
  () => !isEmbedded && typeof route.name === 'string' && TAB_ROUTES.has(route.name),
);

const scheme = useEffectiveScheme();
const custom = useCustomTheme();
const baseSize = useBaseSize();
const kitTheme = reactive<KitThemeValue>({
  scheme: scheme.value,
  palette: { ...defaultKitPalette(scheme.value) },
});
watchEffect(() => {
  kitTheme.scheme = scheme.value;
  const next = custom.value
    ? { ...defaultKitPalette(scheme.value), ...customPalette(scheme.value) }
    : defaultKitPalette(scheme.value);
  Object.assign(kitTheme.palette, next);
});
provide(KitThemeKey, kitTheme);

watchEffect(() => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const active = custom.value;
  root.style.setProperty('--kit-block-radius', active ? `${radiusPx.value}px` : '');
  const d = densityScale.value;
  root.style.setProperty('--kit-density-x', active ? `${d.paddingX}px` : '');
  root.style.setProperty('--kit-density-y', active ? `${d.paddingY}px` : '');
  root.style.fontSize = active ? `${baseSize.value}px` : '';
});
</script>

<template>
  <Col class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark
    text-metro-fg-light dark:text-metro-fg-dark no-scrollbar"
    :class="showTabs ? 'pb-[60px]' : ''">
    <RouterView />
    <!-- The TabBar only shows on the top-level tab routes (channels, contacts,
         settings hub, profile); mobile pushes conversation, group detail, user
         profile, new-group and settings subpages full-screen WITHOUT it. -->
    <TabBar
      v-if="showTabs"
      class="fixed bottom-0 left-0 right-0 z-20"
    />
  </Col>
</template>

<style>
.no-scrollbar::-webkit-scrollbar { display: none; }
html, body { scrollbar-width: none; -ms-overflow-style: none; }
</style>
