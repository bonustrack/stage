<script setup lang="ts">
/** Root layout. Tab bar is pinned to the bottom on tab routes and hidden on the
 *  full-screen XMTP conversation view. Theme class is installed in main.ts. */

const route = useRoute();
const showTabs = computed(() => route.name !== 'xmtp');
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
