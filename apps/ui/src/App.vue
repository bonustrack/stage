<script setup lang="ts">
const route = useRoute();
/** Hide the bottom tab bar on sub-pages (event detail) — only show on tab destinations. */
const showTabs = computed(() => route.name !== 'event');
</script>

<template>
  <div class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark text-metro-fg-light dark:text-metro-fg-dark"
    :class="showTabs ? 'pb-[60px]' : ''">
    <RouterView />
    <TabBar v-if="showTabs" class="fixed bottom-0 left-0 right-0 z-20" />
  </div>
</template>
