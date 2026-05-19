<script setup lang="ts">
const route = useRoute();
/** Hide the bottom tab bar on sub-pages (event detail) — only show on tab destinations. */
const showTabs = computed(() => route.name !== 'event');
</script>

<template>
  <div class="min-h-screen flex flex-col bg-metro-bg-light dark:bg-metro-bg-dark text-metro-fg-light dark:text-metro-fg-dark">
    <div class="flex-1 min-h-0">
      <RouterView />
    </div>
    <TabBar v-if="showTabs" />
  </div>
</template>
