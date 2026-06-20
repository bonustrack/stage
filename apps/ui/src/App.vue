<script setup lang="ts">

const route = useRoute();
const isEmbedded = runningInIframe();
const showTabs = computed(
  () => !isEmbedded && route.name !== 'xmtp' && route.name !== 'embed',
);
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
