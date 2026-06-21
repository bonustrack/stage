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
const showTabs = computed(
  () => !isEmbedded && route.name !== 'xmtp' && route.name !== 'embed',
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
  <div class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark
    text-metro-fg-light dark:text-metro-fg-dark no-scrollbar"
    :class="showTabs ? 'pb-[60px]' : ''">
    <RouterView />
    <TabBar
      v-if="showTabs"
      class="fixed bottom-0 left-0 right-0 z-20"
    />
  </div>
</template>

<style>
.no-scrollbar::-webkit-scrollbar { display: none; }
html, body { scrollbar-width: none; -ms-overflow-style: none; }
</style>
