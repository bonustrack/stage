<script setup lang="ts">
import { provide, reactive, watchEffect } from 'vue';
import {
  KitThemeKey,
  defaultKitPalette,
  type KitThemeValue,
} from '@stage-labs/kit/vue/theme-context';
import { useEffectiveScheme } from './lib/kitTheme';

const route = useRoute();
const isEmbedded = runningInIframe();
const TAB_ROUTES = new Set(['channels', 'contacts', 'wallet', 'settings', 'profile']);
const showTabs = computed(
  () => !isEmbedded && typeof route.name === 'string' && TAB_ROUTES.has(route.name),
);

const scheme = useEffectiveScheme();
const kitTheme = reactive<KitThemeValue>({
  scheme: scheme.value,
  palette: { ...defaultKitPalette(scheme.value) },
});
watchEffect(() => {
  kitTheme.scheme = scheme.value;
  Object.assign(kitTheme.palette, defaultKitPalette(scheme.value));
});
provide(KitThemeKey, kitTheme);
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
