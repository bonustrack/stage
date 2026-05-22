<script setup lang="ts">
const route = useRoute();
/** Hide the bottom tab bar on sub-pages (event detail) — only show on tab destinations. */
const showTabs = computed(() => route.name !== 'event');

/** Twitter-style hide-on-scroll: tab bar disappears when scrolling down, reappears scrolling up. */
const tabsVisible = ref(true);
let lastY = 0;
function onScroll(): void {
  const y = window.scrollY;
  /** Always show at the top; below 4px we treat as "near top". */
  if (y < 4) { tabsVisible.value = true; lastY = y; return; }
  const delta = y - lastY;
  if (Math.abs(delta) < 6) return;
  tabsVisible.value = delta < 0;
  lastY = y;
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
</script>

<template>
  <!-- `pb-[60px]` reserves space for the fixed TabBar on every page EXCEPT messenger:
       messenger owns its bottom edge (contained scroll + sticky composer) and the
       extra padding pushes the composer off-screen below the tab bar. -->
  <div class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark text-metro-fg-light dark:text-metro-fg-dark no-scrollbar"
    :class="showTabs && route.name !== 'messenger' ? 'pb-[60px]' : ''">
    <RouterView />
    <TabBar
      v-if="showTabs"
      class="fixed bottom-0 left-0 right-0 z-20 transition-transform duration-200"
      :class="tabsVisible ? 'translate-y-0' : 'translate-y-full'"
    />
  </div>
</template>

<style>
.no-scrollbar::-webkit-scrollbar { display: none; }
html, body { scrollbar-width: none; -ms-overflow-style: none; }
</style>
